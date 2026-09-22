/* ---------------------------------------------------------------------------
 * ternary_simd.h — High-performance Bit-Sliced Ternary Matrix Operations
 * ---------------------------------------------------------------------------
 * Provides AVX2 and 64-bit portable bit-sliced linear algebra for
 * discrete balanced ternary neural networks (weights and activations in {-1, 0, +1}).
 * ------------------------------------------------------------------------- */

#ifndef TERNARY_SIMD_H
#define TERNARY_SIMD_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Packs a flat array of int8 trits {-1, 0, +1} into bit-sliced (P, M) words.
 *
 * @param trits      Input array of length count, values in {-1, 0, +1}
 * @param count      Total number of trits
 * @param out_p      Output array of uint64_t with length ceil(count / 64)
 * @param out_m      Output array of uint64_t with length ceil(count / 64)
 */
void pack_trits_i8(const int8_t *trits, size_t count, uint64_t *out_p, uint64_t *out_m);

/**
 * Packs a float array with threshold into bit-sliced (P, M) words.
 * Trits > delta -> +1; trits < -delta -> -1; otherwise 0.
 */
void pack_trits_f32(const float *vals, size_t count, float delta, uint64_t *out_p, uint64_t *out_m);

/**
 * Unpacks bit-sliced (P, M) words into an array of int8 trits.
 */
void unpack_trits_i8(const uint64_t *p, const uint64_t *m, size_t count, int8_t *out_trits);

/**
 * Computes matrix-vector product y = W * x for bit-sliced ternary inputs and weights.
 *
 * @param W_p        Bit-sliced positive mask for W of shape (M, N) [M * ceil(N/64) uint64_t]
 * @param W_m        Bit-sliced negative mask for W of shape (M, N)
 * @param x_p        Bit-sliced positive mask for x of length N [ceil(N/64) uint64_t]
 * @param x_m        Bit-sliced negative mask for x of length N
 * @param M          Number of rows (output dimension)
 * @param N          Number of columns (input dimension)
 * @param y_out      Output integer array of length M
 */
void ternary_matvec(const uint64_t *W_p, const uint64_t *W_m,
                    const uint64_t *x_p, const uint64_t *x_m,
                    size_t M, size_t N,
                    int32_t *y_out);

/**
 * Computes batch matrix multiplication Y = X * W^T for bit-sliced ternary arrays.
 *
 * @param X_p        Batch positive mask of shape (B, N) [B * ceil(N/64) uint64_t]
 * @param X_m        Batch negative mask of shape (B, N)
 * @param W_p        Weight positive mask of shape (M, N) [M * ceil(N/64) uint64_t]
 * @param W_m        Weight negative mask of shape (M, N)
 * @param B          Batch size
 * @param M          Output features
 * @param N          Input features
 * @param Y_out      Output buffer of shape (B, M) as int32_t
 */
void ternary_matmul_batch(const uint64_t *X_p, const uint64_t *X_m,
                          const uint64_t *W_p, const uint64_t *W_m,
                          size_t B, size_t M, size_t N,
                          int32_t *Y_out);

/**
 * Continuous embedding layer with ternary weights:
 * Computes Y = X * W^T where X is float32 (B, N) and W is ternary (M, N).
 * Multiplication-free: executes as pure additions and subtractions.
 */
void ternary_weight_continuous_input_matmul(const float *X,
                                            const uint64_t *W_p, const uint64_t *W_m,
                                            size_t B, size_t M, size_t N,
                                            float *Y_out);

#ifdef __cplusplus
}
#endif

#endif /* TERNARY_SIMD_H */
