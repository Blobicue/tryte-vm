"""
quantizer.py — Balanced Ternary Quantization & Straight-Through Estimator
========================================================================
Implements differentiable projection from continuous real numbers into
balanced ternary trits {-1, 0, +1}.
"""

import torch
import torch.nn as nn
from typing import Optional


class TernarySTE(torch.autograd.Function):
    """
    Straight-Through Estimator for balanced ternary quantization {-1, 0, +1}.
    Forward:
        w_ternary = +1 if theta > delta
                  = -1 if theta < -delta
                  =  0 otherwise
    Backward:
        Passes gradients unchanged where |theta| <= clip_val.
    """

    @staticmethod
    def forward(ctx, theta: torch.Tensor, delta: float = 0.35, clip_val: float = 1.5) -> torch.Tensor:
        ctx.save_for_backward(theta)
        ctx.clip_val = clip_val

        out = torch.zeros_like(theta)
        out[theta > delta] = 1.0
        out[theta < -delta] = -1.0
        return out

    @staticmethod
    def backward(ctx, grad_output: torch.Tensor):
        (theta,) = ctx.saved_tensors
        grad_input = grad_output.clone()
        # Clip gradient outside [-clip_val, clip_val] to prevent exploding gradients
        grad_input[theta.abs() > ctx.clip_val] = 0.0
        return grad_input, None, None


def ternarize(theta: torch.Tensor, delta: float = 0.35, clip_val: float = 1.5) -> torch.Tensor:
    """Convenience function for balanced ternary quantization with STE."""
    return TernarySTE.apply(theta, delta, clip_val)


class TernaryLinear(nn.Module):
    """
    Linear layer with continuous latent weights and discrete balanced ternary execution.
    - Weights in forward pass are strictly in {-1, 0, +1}.
    - Latent weights undergo continuous weight decay, pulling values towards 0 (pruning).
    - Can output discrete int8 matrices for native SIMD execution.
    """

    def __init__(
        self,
        in_features: int,
        out_features: int,
        bias: bool = False,
        delta: float = 0.35,
        clip_val: float = 1.5,
    ):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.delta = delta
        self.clip_val = clip_val

        # Continuous latent parameter initialized with He/Glorot normal
        self.weight = nn.Parameter(torch.empty(out_features, in_features))
        if bias:
            self.bias = nn.Parameter(torch.zeros(out_features))
        else:
            self.register_parameter("bias", None)

        self.reset_parameters()

    def reset_parameters(self):
        nn.init.xavier_normal_(self.weight)
        if self.bias is not None:
            nn.init.zeros_(self.bias)

    @property
    def ternary_weight(self) -> torch.Tensor:
        """Returns the current discrete ternary weights in {-1, 0, +1}."""
        return ternarize(self.weight, self.delta, self.clip_val)

    def get_sparsity(self) -> dict[str, float]:
        """Returns distribution of -1, 0, +1 trits in the layer."""
        with torch.no_grad():
            w = self.ternary_weight
            total = w.numel()
            n_pos = (w == 1.0).sum().item()
            n_neg = (w == -1.0).sum().item()
            n_zero = (w == 0.0).sum().item()
            return {
                "pct_plus": n_pos / total * 100.0,
                "pct_minus": n_neg / total * 100.0,
                "pct_zero": n_zero / total * 100.0,
                "active_sparsity": 1.0 - (n_zero / total),
            }

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        w_ternary = self.ternary_weight
        return nn.functional.linear(x, w_ternary, self.bias)
