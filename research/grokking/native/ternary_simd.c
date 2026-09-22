/* ---------------------------------------------------------------------------
 * ternary_simd.c — High-performance Bit-Sliced Ternary Matrix Engine
 * ---------------------------------------------------------------------------
 * Zero-multiplication balanced ternary matrix operations using (P, M) bit-slicing
 * with AVX2 (x86_64) and NEON (aarch64) vectorization.
 * ------------------------------------------------------------------------- */

#include "ternary_simd.h"
#include <stdlib.h>
#include <string.h>

#if defined(__x86_64__) && defined(__AVX2__)
  #include <immintrin.h>
  #define HAS_AVX2 1
#elif defined(__aarch64__) || defined(__ARM_NEON)
  #include <arm_neon.h>
  #define HAS_NEON 1
#endif

static inline size_t words_for_n(size_t n) {
    return (n + 63) / 64;
}

void pack_trits_i8(const int8_t *trits, size_t count, uint64_t *out_p, uint64_t *out_m) {
    size_t k = words_for_n(count);
    memset(out_p, 0, k * sizeof(uint64_t));
    memset(out_m, 0, k * sizeof(uint64_t));

    for (size_t i = 0; i < count; i++) {
        size_t word_idx = i / 64;
        uint64_t bit = 1ULL << (i % 64);
        int8_t v = trits[i];
        if (v > 0) {
            out_p[word_idx] |= bit;
        } else if (v < 0) {
            out_m[word_idx] |= bit;
        }
    }
}

void pack_trits_f32(const float *vals, size_t count, float delta, uint64_t *out_p, uint64_t *out_m) {
    size_t k = words_for_n(count);
    memset(out_p, 0, k * sizeof(uint64_t));
    memset(out_m, 0, k * sizeof(uint64_t));

    for (size_t i = 0; i < count; i++) {
        size_t word_idx = i / 64;
        uint64_t bit = 1ULL << (i % 64);
        float v = vals[i];
        if (v > delta) {
            out_p[word_idx] |= bit;
        } else if (v < -delta) {
            out_m[word_idx] |= bit;
        }
    }
}

void unpack_trits_i8(const uint64_t *p, const uint64_t *m, size_t count, int8_t *out_trits) {
    for (size_t i = 0; i < count; i++) {
        size_t word_idx = i / 64;
        uint64_t bit = 1ULL << (i % 64);
        if (p[word_idx] & bit) {
            out_trits[i] = 1;
        } else if (m[word_idx] & bit) {
            out_trits[i] = -1;
        } else {
            out_trits[i] = 0;
        }
    }
}

void ternary_matvec(const uint64_t *W_p, const uint64_t *W_m,
                    const uint64_t *x_p, const uint64_t *x_m,
                    size_t M, size_t N,
                    int32_t *y_out) {
    size_t K = words_for_n(N);

    for (size_t i = 0; i < M; i++) {
        const uint64_t *wp_row = &W_p[i * K];
        const uint64_t *wm_row = &W_m[i * K];
        int32_t sum = 0;
        size_t k = 0;

#if defined(HAS_AVX2)
        for (; k + 4 <= K; k += 4) {
            __m256i wp = _mm256_loadu_si256((const __m256i*)&wp_row[k]);
            __m256i wm = _mm256_loadu_si256((const __m256i*)&wm_row[k]);
            __m256i xp = _mm256_loadu_si256((const __m256i*)&x_p[k]);
            __m256i xm = _mm256_loadu_si256((const __m256i*)&x_m[k]);

            __m256i term_p = _mm256_or_si256(
                _mm256_and_si256(wp, xp),
                _mm256_and_si256(wm, xm)
            );
            __m256i term_m = _mm256_or_si256(
                _mm256_and_si256(wp, xm),
                _mm256_and_si256(wm, xp)
            );

            uint64_t p0 = (uint64_t)_mm256_extract_epi64(term_p, 0);
            uint64_t p1 = (uint64_t)_mm256_extract_epi64(term_p, 1);
            uint64_t p2 = (uint64_t)_mm256_extract_epi64(term_p, 2);
            uint64_t p3 = (uint64_t)_mm256_extract_epi64(term_p, 3);

            uint64_t m0 = (uint64_t)_mm256_extract_epi64(term_m, 0);
            uint64_t m1 = (uint64_t)_mm256_extract_epi64(term_m, 1);
            uint64_t m2 = (uint64_t)_mm256_extract_epi64(term_m, 2);
            uint64_t m3 = (uint64_t)_mm256_extract_epi64(term_m, 3);

            sum += (__builtin_popcountll(p0) + __builtin_popcountll(p1) +
                    __builtin_popcountll(p2) + __builtin_popcountll(p3)) -
                   (__builtin_popcountll(m0) + __builtin_popcountll(m1) +
                    __builtin_popcountll(m2) + __builtin_popcountll(m3));
        }
#elif defined(HAS_NEON)
        for (; k + 2 <= K; k += 2) {
            uint8x16_t wp = vld1q_u8((const uint8_t*)&wp_row[k]);
            uint8x16_t wm = vld1q_u8((const uint8_t*)&wm_row[k]);
            uint8x16_t xp = vld1q_u8((const uint8_t*)&x_p[k]);
            uint8x16_t xm = vld1q_u8((const uint8_t*)&x_m[k]);

            uint8x16_t term_p = vorrq_u8(vandq_u8(wp, xp), vandq_u8(wm, xm));
            uint8x16_t term_m = vorrq_u8(vandq_u8(wp, xm), vandq_u8(wm, xp));

            uint8x16_t pop_p = vcntq_u8(term_p);
            uint8x16_t pop_m = vcntq_u8(term_m);

            sum += (int32_t)vaddlvq_u8(pop_p) - (int32_t)vaddlvq_u8(pop_m);
        }
#endif

        for (; k < K; k++) {
            uint64_t wp = wp_row[k];
            uint64_t wm = wm_row[k];
            uint64_t xp = x_p[k];
            uint64_t xm = x_m[k];

            uint64_t term_p = (wp & xp) | (wm & xm);
            uint64_t term_m = (wp & xm) | (wm & xp);

            sum += (int32_t)(__builtin_popcountll(term_p) - __builtin_popcountll(term_m));
        }

        y_out[i] = sum;
    }
}

void ternary_matmul_batch(const uint64_t *X_p, const uint64_t *X_m,
                          const uint64_t *W_p, const uint64_t *W_m,
                          size_t B, size_t M, size_t N,
                          int32_t *Y_out) {
    size_t K = words_for_n(N);

    for (size_t b = 0; b < B; b++) {
        const uint64_t *xp_b = &X_p[b * K];
        const uint64_t *xm_b = &X_m[b * K];
        int32_t *y_b = &Y_out[b * M];

        ternary_matvec(W_p, W_m, xp_b, xm_b, M, N, y_b);
    }
}

void ternary_weight_continuous_input_matmul(const float *X,
                                            const uint64_t *W_p, const uint64_t *W_m,
                                            size_t B, size_t M, size_t N,
                                            float *Y_out) {
    size_t K = words_for_n(N);

    for (size_t b = 0; b < B; b++) {
        const float *x_b = &X[b * N];
        float *y_b = &Y_out[b * M];

        for (size_t i = 0; i < M; i++) {
            const uint64_t *wp_row = &W_p[i * K];
            const uint64_t *wm_row = &W_m[i * K];
            float sum = 0.0f;

            for (size_t k = 0; k < K; k++) {
                uint64_t wp = wp_row[k];
                uint64_t wm = wm_row[k];

                while (wp) {
                    int tz = __builtin_ctzll(wp);
                    size_t j = k * 64 + (size_t)tz;
                    if (j < N) {
                        sum += x_b[j];
                    }
                    wp &= wp - 1; // Clear lowest set bit
                }

                while (wm) {
                    int tz = __builtin_ctzll(wm);
                    size_t j = k * 64 + (size_t)tz;
                    if (j < N) {
                        sum -= x_b[j];
                    }
                    wm &= wm - 1; // Clear lowest set bit
                }
            }

            y_b[i] = sum;
        }
    }
}
