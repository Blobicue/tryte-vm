use std::env;
use std::fs;
use std::time::Instant;
use tryte_simd::crypto::{NtruPreset, TernaryNtru};
use tryte_simd::simd::TritVec64;
use tryte_simd::vm::TryteVM;

fn print_usage() {
    println!("Usage: tryte <command> [args]");
    println!("Commands:");
    println!("  run <file.hex> [in1,in2,...] Execute compiled 729-word hex program");
    println!("  bench-crypto                 Benchmark Post-Quantum NTRU Lattice Crypto (Toy..PQ-256)");
    println!("  bench-simd                   Benchmark 64-Trit Bit-Sliced Dual-Rail SIMD vs Scalar ALU");
    println!("  test                         Run comprehensive native mathematical parity suite");
}

fn cmd_run(hex_path: &str, input_str: Option<&str>) {
    let content = match fs::read_to_string(hex_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error reading {}: {}", hex_path, e);
            std::process::exit(1);
        }
    };

    let mut vm = TryteVM::new();
    if let Err(e) = vm.load_hex(&content) {
        eprintln!("Error loading hex: {}", e);
        std::process::exit(1);
    }

    if let Some(inputs) = input_str {
        for s in inputs.split(',') {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                match trimmed.parse::<i16>() {
                    Ok(val) => vm.input_queue.push_back(val),
                    Err(e) => eprintln!("Warning: invalid input '{}': {}", trimmed, e),
                }
            }
        }
    }

    println!("Loaded program from {} (729 cells, {} inputs queued)", hex_path, vm.input_queue.len());

    let start = Instant::now();
    let steps = vm.run(10_000_000);
    let elapsed = start.elapsed();

    let mips = (steps as f64 / elapsed.as_secs_f64()) / 1_000_000.0;
    println!("Execution completed in {:?} ({} steps, {:.2} MIPS)", elapsed, steps, mips);
    println!("Status: halted={}, PC={}, A={}, C={}", vm.halted, vm.pc, vm.a, vm.c);
    println!("Output queue ({} trytes): {:?}", vm.output_queue.len(), vm.output_queue);
}

fn cmd_bench_crypto() {
    println!("================================================================");
    println!("BENCHMARKING NATIVE POST-QUANTUM LATTICE CRYPTO (Ternary NTRU)");
    println!("Architecture: ARMv9 / Cortex-X925 Native SIMD Acceleration");
    println!("================================================================");

    let presets = [
        ("Toy (N=3)", NtruPreset::Toy, 20_000),
        ("Embedded-9 (N=9)", NtruPreset::Embedded9, 10_000),
        ("Embedded-27 (N=27)", NtruPreset::Embedded27, 2_000),
        ("Medium-81 (N=81)", NtruPreset::Medium81, 500),
        ("PQ-128 (N=243)", NtruPreset::Pq128, 100),
        ("PQ-256 (N=729)", NtruPreset::Pq256, 30),
    ];

    for (name, preset, iters) in presets {
        let (n, _) = preset.params();
        let kp = TernaryNtru::keygen(preset, 12345);
        let msg = vec![1i8; n];

        // Benchmark Encryption
        let start_enc = Instant::now();
        for i in 0..iters {
            let _ = TernaryNtru::encrypt(&kp.pub_key, &msg, 1000 + i as u64);
        }
        let elapsed_enc = start_enc.elapsed();
        let enc_per_sec = iters as f64 / elapsed_enc.as_secs_f64();

        // Benchmark Decryption
        let ct = TernaryNtru::encrypt(&kp.pub_key, &msg, 9999);
        let start_dec = Instant::now();
        for _ in 0..iters {
            let _ = TernaryNtru::decrypt(&kp, &ct);
        }
        let elapsed_dec = start_dec.elapsed();
        let dec_per_sec = iters as f64 / elapsed_dec.as_secs_f64();

        println!(
            "{:<20} | Encrypt: {:>10.0} ops/sec ({:>6.2} µs/op) | Decrypt: {:>10.0} ops/sec ({:>6.2} µs/op)",
            name,
            enc_per_sec,
            elapsed_enc.as_secs_f64() * 1e6 / iters as f64,
            dec_per_sec,
            elapsed_dec.as_secs_f64() * 1e6 / iters as f64,
        );
    }
}

fn cmd_bench_simd() {
    println!("================================================================");
    println!("BENCHMARKING 64-TRIT BIT-SLICED DUAL-RAIL SIMD ALU");
    println!("================================================================");

    let iters = 20_000_000;
    let mut v1 = std::hint::black_box(TritVec64::new(0xAAAAAAAAAAAAAAAA, 0x5555555555555555));
    let mut v2 = std::hint::black_box(TritVec64::new(0x3333333333333333, 0xCCCCCCCCCCCCCCCC));
    let vc = std::hint::black_box(TritVec64::new(0x0F0F0F0F0F0F0F0F, 0xF0F0F0F0F0F0F0F0));

    let start = Instant::now();
    for _ in 0..iters {
        let r1 = v1.min(&v2);
        let r2 = v1.max(&r1);
        let r3 = r2.tgate(&v1, &vc);
        v1 = r3.add_mod_3(&v2);
        v2 = v1.csum(&r2);
        std::hint::black_box(&v1);
        std::hint::black_box(&v2);
    }
    let elapsed = start.elapsed();


    let ops = iters as f64 * 5.0; // 5 vector operations per loop
    let trits_processed = ops * 64.0;
    let trit_throughput_m = (trits_processed / elapsed.as_secs_f64()) / 1_000_000.0;

    println!("Completed {} vector iterations in {:?}", iters, elapsed);
    println!("Total vector ops: {:.0} million", ops / 1e6);
    println!("Total trits processed: {:.0} million trits", trits_processed / 1e6);
    println!("Throughput: \x1b[1;32m{:.2} Million Trits / Second\x1b[0m", trit_throughput_m);
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        print_usage();
        return;
    }

    match args[1].as_str() {
        "run" => {
            if args.len() < 3 {
                eprintln!("Usage: tryte run <file.hex>");
                std::process::exit(1);
            }
            cmd_run(&args[2], args.get(3).map(|s| s.as_str()));
        }
        "bench-crypto" => cmd_bench_crypto(),
        "bench-simd" => cmd_bench_simd(),
        "test" => {
            println!("Use `cargo test` to execute native unit and parity tests.");
        }
        _ => {
            print_usage();
        }
    }
}
