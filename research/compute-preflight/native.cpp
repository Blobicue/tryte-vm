/*
 * Correctness-first native ternary feature-packing preflight.
 *
 * NOT REGISTERED: arithmetic identities, representable bounds, and deterministic
 * correctness fixtures are derived checks, not empirical performance predictions.
 * Performance registration, compiler command and provenance belong in audit.cjs.
 * Do not run --bench before that registration is committed.
 *
 * This is a bounded dense-layer microbenchmark, not a mesh worker or neural
 * training engine. Bits in a word are FEATURES of one dot product, not independent
 * examples. POPCNT is not a claim of AVX2 population count or 256-bit bit slicing.
 * The registered executable is built for znver3, not a generic runtime-dispatched
 * binary. The performance-entry feature check is a guard, not a portability proof
 * for executing this optimized binary on a different processor.
 */
#include <algorithm>
#include <array>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

#if defined(__GNUC__) || defined(__clang__)
#define PREFLIGHT_NOINLINE __attribute__((noinline))
#else
#define PREFLIGHT_NOINLINE
#endif

namespace preflight {
constexpr std::array<std::size_t, 7> widths{{31, 32, 33, 64, 65, 256, 1024}};
constexpr std::size_t bench_rows = 32;
constexpr std::size_t bench_batch = 16;
constexpr unsigned repeats = 7;
constexpr unsigned warmup = 8;
constexpr unsigned iterations = 128;
constexpr std::size_t max_width = 65536;
constexpr std::size_t max_values = 1u << 22;
constexpr std::int32_t max_bias = 1000000;
volatile std::uint64_t observable = 0;

void require(bool yes, const char* reason) {
  if (!yes) throw std::runtime_error(reason);
}

void barrier() {
#if defined(__GNUC__) || defined(__clang__)
  __asm__ __volatile__("" ::: "memory");
#endif
}

unsigned popcount(std::uint64_t word) {
#if defined(__GNUC__) || defined(__clang__)
  return static_cast<unsigned>(__builtin_popcountll(word));
#else
  unsigned n = 0;
  while (word) { word &= word - 1; ++n; }
  return n;
#endif
}

struct Layer {
  std::size_t width, rows, batch;
  std::vector<std::int8_t> x, w;
  std::vector<std::int32_t> bias, threshold;
};

void validate(const Layer& d) {
  require(d.width <= max_width, "width exceeds bounded accumulator contract");
  require(d.rows && d.batch && d.rows <= 4096 && d.batch <= 4096,
          "rows and batch must be bounded and nonzero");
  require(d.width * (d.rows + d.batch) <= max_values &&
          d.rows * d.batch <= max_values, "layer exceeds value resource limit");
  require(d.x.size() == d.width * d.batch && d.w.size() == d.width * d.rows,
          "dense shape mismatch");
  require(d.bias.size() == d.rows && d.threshold.size() == d.rows,
          "row parameters shape mismatch");
  for (auto v : d.x) require(v >= -1 && v <= 1, "input is not ternary");
  for (auto v : d.w) require(v >= -1 && v <= 1, "weight is not ternary");
  for (auto v : d.bias) require(v >= -max_bias && v <= max_bias,
                               "bias exceeds bounded accumulator contract");
  for (auto v : d.threshold) require(v >= 0 && v <= max_bias,
                                    "threshold must be bounded and nonnegative");
}

std::int8_t activate(std::int32_t sum, std::int32_t threshold) {
  return sum > threshold ? 1 : sum < -threshold ? -1 : 0;
}

struct Output {
  std::vector<std::int32_t> sums;
  std::vector<std::int8_t> activations;
  explicit Output(std::size_t n) : sums(n), activations(n) {}
  bool operator==(const Output& b) const {
    return sums == b.sums && activations == b.activations;
  }
};

// Independent oracle uses sign cases and int64 accumulation, not packed algebra
// or the multiply/reduce loop offered to the compiler as the native baseline.
Output oracle(const Layer& d) {
  validate(d);
  Output out(d.rows * d.batch);
  for (std::size_t b = 0; b < d.batch; ++b) {
    for (std::size_t r = 0; r < d.rows; ++r) {
      std::int64_t sum = d.bias[r];
      for (std::size_t i = 0; i < d.width; ++i) {
        auto a = d.x[b * d.width + i], w = d.w[r * d.width + i];
        if (a && w) sum += a == w ? 1 : -1;
      }
      auto at = b * d.rows + r;
      out.sums[at] = static_cast<std::int32_t>(sum);
      out.activations[at] = sum > d.threshold[r] ? 1 :
                            sum < -d.threshold[r] ? -1 : 0;
    }
  }
  return out;
}

PREFLIGHT_NOINLINE void native(const Layer& d, Output& out) {
  for (std::size_t b = 0; b < d.batch; ++b) {
    for (std::size_t r = 0; r < d.rows; ++r) {
      std::int32_t sum = 0;
      const auto* a = d.width ? d.x.data() + b * d.width : nullptr;
      const auto* w = d.width ? d.w.data() + r * d.width : nullptr;
      for (std::size_t i = 0; i < d.width; ++i)
        sum += static_cast<std::int32_t>(a[i]) * static_cast<std::int32_t>(w[i]);
      sum += d.bias[r];
      auto at = b * d.rows + r;
      out.sums[at] = sum;
      out.activations[at] = activate(sum, d.threshold[r]);
    }
  }
}

enum class Encoding { dual, sign };
struct Packed {
  std::size_t width, count, words;
  Encoding encoding;
  std::vector<std::uint64_t> first, second;
  Packed(std::size_t n, std::size_t c, Encoding e)
      : width(n), count(c), words((n + 63) / 64), encoding(e),
        first(words * c), second(words * c) {}
};

// Caller has validated ternary data once at the boundary. Packing writes every
// destination word afresh; tails are zero even when storage is reused.
PREFLIGHT_NOINLINE void pack(const std::vector<std::int8_t>& values, Packed& p) {
  std::fill(p.first.begin(), p.first.end(), 0);
  std::fill(p.second.begin(), p.second.end(), 0);
  for (std::size_t r = 0; r < p.count; ++r) {
    for (std::size_t i = 0; i < p.width; ++i) {
      auto v = values[r * p.width + i];
      auto at = r * p.words + i / 64;
      const std::uint64_t bit = std::uint64_t{1} << (i % 64);
      if (p.encoding == Encoding::dual ? v > 0 : v != 0) p.first[at] |= bit;
      if (v < 0) p.second[at] |= bit;
    }
  }
}

void validate_packed(const Packed& p) {
  require(p.width <= max_width && p.count <= 4096, "packed resource limit");
  require(p.words == (p.width + 63) / 64 &&
          p.first.size() == p.words * p.count &&
          p.second.size() == p.first.size(), "packed shape mismatch");
  for (std::size_t i = 0; i < p.first.size(); ++i) {
    require(p.encoding == Encoding::dual ? !(p.first[i] & p.second[i]) :
            !(p.second[i] & ~p.first[i]), "noncanonical packed rails");
  }
  if (p.words && p.width % 64) {
    const auto mask = (std::uint64_t{1} << (p.width % 64)) - 1;
    for (std::size_t r = 0; r < p.count; ++r) {
      auto at = (r + 1) * p.words - 1;
      require(!((p.first[at] | p.second[at]) & ~mask), "nonzero packed tail");
    }
  }
}

PREFLIGHT_NOINLINE void packed_layer(const Layer& d, const Packed& a,
                                     const Packed& w, Output& out) {
  for (std::size_t b = 0; b < d.batch; ++b) {
    for (std::size_t r = 0; r < d.rows; ++r) {
      std::int32_t sum = 0;
      for (std::size_t i = 0; i < a.words; ++i) {
        const auto ai = b * a.words + i, wi = r * w.words + i;
        if (a.encoding == Encoding::dual) {
          const auto positive = (a.first[ai] & w.first[wi]) |
                                (a.second[ai] & w.second[wi]);
          const auto negative = (a.first[ai] & w.second[wi]) |
                                (a.second[ai] & w.first[wi]);
#ifdef COMPUTE_PREFLIGHT_MUTATE_DUAL_SIGN
          sum += static_cast<std::int32_t>(popcount(positive)) +
                 static_cast<std::int32_t>(popcount(negative));
#else
          sum += static_cast<std::int32_t>(popcount(positive)) -
                 static_cast<std::int32_t>(popcount(negative));
#endif
        } else {
          const auto active = a.first[ai] & w.first[wi];
          const auto opposite = (a.second[ai] ^ w.second[wi]) & active;
          sum += static_cast<std::int32_t>(popcount(active)) -
                 2 * static_cast<std::int32_t>(popcount(opposite));
        }
      }
      sum += d.bias[r];
      const auto at = b * d.rows + r;
      out.sums[at] = sum;
      out.activations[at] = activate(sum, d.threshold[r]);
    }
  }
}

std::uint32_t random_word(std::uint32_t& s) {
  s ^= s << 13; s ^= s >> 17; s ^= s << 5;
  return s;
}

Layer data(std::size_t n, std::size_t rows, std::size_t batch, std::uint32_t seed) {
  Layer d{n, rows, batch, std::vector<std::int8_t>(n * batch),
          std::vector<std::int8_t>(n * rows), std::vector<std::int32_t>(rows),
          std::vector<std::int32_t>(rows)};
  // Each consecutive triple contains all three states; the order is seeded.
  auto fill = [&](std::vector<std::int8_t>& values) {
    for (std::size_t i = 0; i < values.size(); i += 3) {
      auto offset = random_word(seed) % 3;
      auto direction = (random_word(seed) & 1) ? 1u : 2u;
      for (unsigned j = 0; j < 3 && i + j < values.size(); ++j)
        values[i + j] = static_cast<std::int8_t>((offset + direction * j) % 3) - 1;
    }
  };
  fill(d.x); fill(d.w);
  for (std::size_t r = 0; r < rows; ++r) {
    d.bias[r] = static_cast<std::int32_t>(random_word(seed) % 7) - 3;
    d.threshold[r] = static_cast<std::int32_t>(r % 4);
  }
  validate(d);
  return d;
}

std::uint64_t output_hash(const Output& out) {
  std::uint64_t h = 1469598103934665603ull;
  for (std::size_t i = 0; i < out.sums.size(); ++i) {
    h = (h ^ static_cast<std::uint32_t>(out.sums[i])) * 1099511628211ull;
    h = (h ^ static_cast<std::uint8_t>(out.activations[i])) * 1099511628211ull;
  }
  return h;
}

unsigned self_test() {
  unsigned checks = 0;
  auto check = [&](bool yes, const char* reason) { require(yes, reason); ++checks; };
  auto rejects = [&](auto fn, const char* reason) {
    bool rejected = false;
    try { fn(); } catch (const std::runtime_error&) { rejected = true; }
    check(rejected, reason);
  };
  auto compare = [&](const Layer& d) {
    const auto wanted = oracle(d);
    Output actual(d.rows * d.batch);
    native(d, actual);
    check(actual == wanted, "native/oracle mismatch");
    for (auto e : {Encoding::dual, Encoding::sign}) {
      Packed a(d.width, d.batch, e), w(d.width, d.rows, e);
      pack(d.x, a); pack(d.w, w);
      validate_packed(a); validate_packed(w);
      packed_layer(d, a, w, actual);
      check(actual == wanted, "packed/oracle mismatch");
    }
  };
  check(activate(3, 2) == 1 && activate(2, 2) == 0 && activate(-2, 2) == 0 &&
        activate(-3, 2) == -1, "symmetric threshold boundary mismatch");
  rejects([&] { require(false, "intentional harness failure"); },
          "harness cannot reject failure");
  for (int a = -1; a <= 1; ++a) for (int b = -1; b <= 1; ++b) {
    Layer d{1, 1, 1, {static_cast<std::int8_t>(a)}, {static_cast<std::int8_t>(b)}, {0}, {0}};
    check(oracle(d).sums[0] == a * b, "hand product mismatch");
    compare(d);
  }
  for (unsigned a = 0; a < 27; ++a) for (unsigned b = 0; b < 27; ++b) {
    Layer d{3, 1, 1, std::vector<std::int8_t>(3), std::vector<std::int8_t>(3), {0}, {0}};
    auto aa = a, bb = b;
    for (unsigned i = 0; i < 3; ++i) {
      d.x[i] = static_cast<std::int8_t>(aa % 3) - 1; aa /= 3;
      d.w[i] = static_cast<std::int8_t>(bb % 3) - 1; bb /= 3;
    }
    compare(d);
  }
  std::vector<std::size_t> check_widths{0, 1, 63, 365};
  check_widths.insert(check_widths.end(), widths.begin(), widths.end());
  check_widths.push_back(max_width);
  for (auto n : check_widths) {
    auto d = data(n, 3, 2, 907u + static_cast<std::uint32_t>(n));
    compare(d);
    std::fill(d.x.begin(), d.x.end(), 1); std::fill(d.w.begin(), d.w.end(), 1);
    std::fill(d.bias.begin(), d.bias.end(), max_bias);
    check(oracle(d).sums[0] == static_cast<std::int32_t>(n) + max_bias,
          "wide positive accumulation mismatch");
    compare(d);
    std::fill(d.w.begin(), d.w.end(), -1);
    std::fill(d.bias.begin(), d.bias.end(), -max_bias);
    check(oracle(d).sums[0] == -static_cast<std::int32_t>(n) - max_bias,
          "wide negative accumulation mismatch");
    compare(d);
  }
  auto invalid = data(3, 1, 1, 5);
  invalid.x[0] = 2;
  rejects([&] { validate(invalid); }, "nonternary value accepted");
  invalid = data(3, 1, 1, 5); invalid.w.pop_back();
  rejects([&] { validate(invalid); }, "bad dense shape accepted");
  invalid = data(3, 1, 1, 5); invalid.threshold[0] = -1;
  rejects([&] { validate(invalid); }, "negative threshold accepted");
  invalid = data(3, 1, 1, 5); invalid.bias[0] = max_bias + 1;
  rejects([&] { validate(invalid); }, "unsafe bias accepted");
  invalid.width = max_width + 1;
  rejects([&] { validate(invalid); }, "unsafe width accepted");
  for (auto e : {Encoding::dual, Encoding::sign}) {
    Packed p(65, 1, e);
    pack(std::vector<std::int8_t>(65, 1), p);
    validate_packed(p); ++checks;
    p.first.back() |= 2;
    rejects([&] { validate_packed(p); }, "noncanonical tail accepted");
    pack(std::vector<std::int8_t>(65, 0), p);
    validate_packed(p);
    check(std::all_of(p.first.begin(), p.first.end(), [](auto v) { return v == 0; }) &&
          std::all_of(p.second.begin(), p.second.end(), [](auto v) { return v == 0; }),
          "repacking left stale bits");
    p.first[0] = e == Encoding::dual ? 1 : 0; p.second[0] = 1;
    rejects([&] { validate_packed(p); }, "invalid rail overlap accepted");
  }
  return checks;
}

struct Working {
  const Layer& d;
  Packed da, dw, sa, sw;
  Output out, wanted;
  explicit Working(const Layer& layer)
      : d(layer), da(d.width, d.batch, Encoding::dual), dw(d.width, d.rows, Encoding::dual),
        sa(d.width, d.batch, Encoding::sign), sw(d.width, d.rows, Encoding::sign),
        out(d.rows * d.batch), wanted(oracle(d)) {
    pack(d.x, da); pack(d.w, dw); pack(d.x, sa); pack(d.w, sw);
    validate_packed(da); validate_packed(dw); validate_packed(sa); validate_packed(sw);
  }
  void perform(const std::string& backend, const std::string& stage) {
    if (backend == "native" || backend == "native_control") { native(d, out); return; }
    auto& a = backend == "dual" ? da : sa;
    auto& w = backend == "dual" ? dw : sw;
    if (stage != "resident") { pack(d.x, a); pack(d.w, w); }
    if (stage != "pack_only") packed_layer(d, a, w, out);
  }
  std::uint64_t witness(const std::string& backend, const std::string& stage, unsigned i) {
    if (stage != "pack_only") {
      auto at = i % out.sums.size();
      return static_cast<std::uint32_t>(out.sums[at]) +
             static_cast<std::uint8_t>(out.activations[at]);
    }
    const auto& a = backend == "dual" ? da : sa;
    const auto& w = backend == "dual" ? dw : sw;
    return a.first[i % a.first.size()] ^ a.second[i % a.second.size()] ^
           w.first[i % w.first.size()] ^ w.second[i % w.second.size()];
  }
  void verify(const std::string& backend, const std::string& stage) {
    perform(backend, stage);
    validate_timed(backend, stage);
  }
  // Unlike verify(), this must inspect the actual final timed result. Repeating
  // perform() first would overwrite a corrupt result and certify its replacement.
  void validate_timed(const std::string& backend, const std::string& stage) {
    if (stage == "pack_only") {
      const auto& a = backend == "dual" ? da : sa;
      const auto& w = backend == "dual" ? dw : sw;
      validate_packed(a); validate_packed(w);
      // Read current timed rails. Do not repack source values before checking.
      packed_layer(d, a, w, out);
    }
#ifndef COMPUTE_PREFLIGHT_MUTATE_TIMED_CHECK
    require(out == wanted, "benchmark exact output mismatch");
#endif
  }
};

unsigned timed_result_tests() {
  unsigned checks = 0;
  auto check = [&](bool yes, const char* reason) { require(yes, reason); ++checks; };
  auto rejects = [&](auto fn, const char* reason) {
    bool rejected = false;
    try { fn(); } catch (const std::runtime_error&) { rejected = true; }
    check(rejected, reason);
  };
  Layer d{65, 1, 1, std::vector<std::int8_t>(65, 1),
          std::vector<std::int8_t>(65, 1), {0}, {0}};
  Working work(d);
  for (const std::string backend : {"native", "native_control", "dual", "sign"}) {
    for (const std::string stage : {"resident", "end_to_end"}) {
      work.verify(backend, stage);
      work.validate_timed(backend, stage);
      check(work.out == work.wanted, "healthy timed output rejected");
      work.out.sums[0] += 1;
      rejects([&] { work.validate_timed(backend, stage); },
              "timed result check accepted corruption");
      work.verify(backend, stage);
      work.out.activations[0] = -1;
      rejects([&] { work.validate_timed(backend, stage); },
              "timed activation check accepted corruption");
    }
  }
  for (const std::string backend : {"dual", "sign"}) {
    work.verify(backend, "pack_only");
    auto& packed = backend == "dual" ? work.da : work.sa;
    packed.first[0] ^= 1; // Valid rails encoding a wrong timed packing result.
    validate_packed(packed);
    rejects([&] { work.validate_timed(backend, "pack_only"); },
            "timed packing check silently repacked corrupted rails");
    work.verify(backend, "pack_only");
    packed.first.back() |= 2;
    rejects([&] { work.validate_timed(backend, "pack_only"); },
            "timed packing check accepted invalid tail");
    work.verify(backend, "pack_only");
    work.validate_timed(backend, "pack_only");
    check(work.out == work.wanted, "healthy timed rails rejected");
  }
  return checks;
}

struct Sample {
  std::size_t width;
  unsigned repeat;
  std::string stage, backend;
  std::int64_t total_ns;
  std::uint64_t checksum;
};

std::vector<Sample> benchmark(std::uint32_t seed) {
  std::vector<Sample> samples;
  for (auto n : widths) {
    auto d = data(n, bench_rows, bench_batch, seed ^ static_cast<std::uint32_t>(n));
    Working work(d);
    const std::vector<std::string> base{"native", "dual", "sign", "native_control"};
    for (const std::string stage : {"resident", "pack_only", "end_to_end"}) {
      for (const auto& backend : base) {
        if (stage == "pack_only" && backend != "dual" && backend != "sign") continue;
        work.verify(backend, stage);
        for (unsigned i = 0; i < warmup; ++i) {
          barrier(); work.perform(backend, stage); observable ^= work.witness(backend, stage, i);
        }
      }
    }
    for (unsigned rep = 0; rep < repeats; ++rep) {
      auto order = base;
      std::rotate(order.begin(), order.begin() + rep % order.size(), order.end());
      if (rep % 2) std::reverse(order.begin(), order.end());
      for (const std::string stage : {"resident", "pack_only", "end_to_end"}) {
        for (const auto& backend : order) {
          if (stage == "pack_only" && backend != "dual" && backend != "sign") continue;
          work.verify(backend, stage);
          std::uint64_t checksum = 0;
          const auto start = std::chrono::steady_clock::now();
          for (unsigned i = 0; i < iterations; ++i) {
            barrier(); work.perform(backend, stage);
            checksum += work.witness(backend, stage, i);
          }
          barrier();
          const auto stop = std::chrono::steady_clock::now();
          observable ^= checksum;
          work.validate_timed(backend, stage);
          samples.push_back({n, rep, stage, backend,
            std::chrono::duration_cast<std::chrono::nanoseconds>(stop - start).count(), checksum});
        }
      }
    }
  }
  return samples;
}

void json_string(const std::string& s) {
  std::cout << '"';
  for (char c : s) {
    if (c == '"' || c == '\\') std::cout << '\\';
    std::cout << c;
  }
  std::cout << '"';
}

bool runtime_avx2() {
#if (defined(__GNUC__) || defined(__clang__)) && (defined(__x86_64__) || defined(__i386__))
  __builtin_cpu_init(); return __builtin_cpu_supports("avx2");
#else
  return false;
#endif
}
bool runtime_popcnt() {
#if (defined(__GNUC__) || defined(__clang__)) && (defined(__x86_64__) || defined(__i386__))
  __builtin_cpu_init(); return __builtin_cpu_supports("popcnt");
#else
  return false;
#endif
}
void print_benchmark(std::uint32_t seed) {
  const auto samples = benchmark(seed);
  std::cout << "{\"schema\":\"compute-preflight-native/v1\",\"mode\":\"bench\",\"seed\":" << seed;
  std::cout << ",\"widths\":[";
  for (std::size_t i = 0; i < widths.size(); ++i) std::cout << (i ? "," : "") << widths[i];
  std::cout << "],\"rows\":" << bench_rows << ",\"batch\":" << bench_batch
            << ",\"repeats\":" << repeats << ",\"warmup\":" << warmup
            << ",\"iterations\":" << iterations
            << ",\"packing\":{\"axis\":\"features\",\"word_bits\":64,\"end_to_end_weights\":true,"
               "\"reuses_storage\":true,\"boundary_validation_timed\":false},\"build\":{\"compiler\":";
#ifdef __VERSION__
  json_string(__VERSION__);
#else
  json_string("unknown");
#endif
#ifdef __AVX2__
  std::cout << ",\"avx2\":true";
#else
  std::cout << ",\"avx2\":false";
#endif
#ifdef __POPCNT__
  std::cout << ",\"popcnt\":true";
#else
  std::cout << ",\"popcnt\":false";
#endif
  std::cout << "},\"runtime\":{\"avx2\":" << (runtime_avx2() ? "true" : "false")
            << ",\"popcnt\":" << (runtime_popcnt() ? "true" : "false")
            << "},\"correct\":true,\"checksum\":\"" << observable << "\",\"samples\":[";
  bool first = true;
  for (const auto& s : samples) {
    if (!first) std::cout << ',';
    first = false;
    std::cout << "{\"width\":" << s.width << ",\"repeat\":" << s.repeat
              << ",\"stage\":\"" << s.stage << "\",\"backend\":\"" << s.backend
              << "\",\"iterations\":" << iterations << ",\"total_ns\":" << s.total_ns
              << ",\"checksum\":\"" << s.checksum << "\"}";
  }
  std::cout << "]}\n";
}
} // namespace preflight

int main(int argc, char** argv) {
  try {
    if (argc == 2 && std::string(argv[1]) == "--self-test") {
      const auto checks = preflight::self_test() + preflight::timed_result_tests();
      std::cout << "{\"schema\":\"compute-preflight-native/v1\",\"mode\":\"self-test\","
                   "\"correct\":true,\"checks\":" << checks
                << ",\"timing_measured\":false}\n";
      return 0;
    }
    if (argc == 4 && std::string(argv[1]) == "--bench" && std::string(argv[2]) == "--seed") {
      const std::string text = argv[3];
      preflight::require(!text.empty() && text.find_first_not_of("0123456789") == std::string::npos,
                         "seed must be a positive uint32 integer");
      const auto value = std::stoull(text);
      preflight::require(value > 0 && value <= std::numeric_limits<std::uint32_t>::max(),
                         "seed must be a positive uint32 integer");
      preflight::require(preflight::runtime_avx2() && preflight::runtime_popcnt(),
                         "performance mode requires AVX2 and POPCNT on this host; znver3 build is not generic dispatch");
      preflight::print_benchmark(static_cast<std::uint32_t>(value));
      return 0;
    }
    throw std::runtime_error("usage: native --self-test | native --bench --seed UINT32");
  } catch (const std::exception& e) {
    std::cerr << "preflight refused: " << e.what() << '\n';
    return 1;
  }
}
