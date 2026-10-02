CC ?= gcc
CFLAGS ?= -O3 -fPIC -Wall -Wextra
LDFLAGS ?= -shared

ARCH := $(shell uname -m)

ifeq ($(ARCH),x86_64)
    CFLAGS += -mavx2
else ifeq ($(ARCH),aarch64)
    # AArch64 has NEON by default
    CFLAGS += -march=native
endif

TARGET = libternary_simd.so
SRCS = ternary_simd.c

all: $(TARGET)

$(TARGET): $(SRCS)
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $^

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
