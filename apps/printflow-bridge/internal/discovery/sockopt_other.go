//go:build !(darwin || freebsd || netbsd || openbsd || dragonfly || linux || windows)

package discovery

func setReuse(uintptr) {}

func setMulticastOpts(uintptr, [4]byte) {}
