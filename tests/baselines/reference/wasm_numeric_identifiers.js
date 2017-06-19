//// [wasm_numeric_identifiers.ts]

export function getNaN() { return NaN; }

export function getInfinity() { return Infinity; }

export function getNegativeInfinity() { return -Infinity; }

//// [out.wasm]
00000000: 00 61 73 6d 01 00 00 00 01 0d 03 60 00 01 7c 60
00000010: 00 01 7c 60 00 01 7c 03 04 03 00 01 02 07 2e 03
00000020: 06 67 65 74 4e 61 4e 00 00 0b 67 65 74 49 6e 66
00000030: 69 6e 69 74 79 00 01 13 67 65 74 4e 65 67 61 74
00000040: 69 76 65 49 6e 66 69 6e 69 74 79 00 02 0a 32 03
00000050: 0c 00 44 01 00 00 00 00 00 f0 7f 0f 0b 0c 00 44
00000060: 00 00 00 00 00 00 f0 7f 0f 0b 16 00 44 00 00 00
00000070: 00 00 00 f0 bf 44 00 00 00 00 00 00 f0 7f a2 0f
00000080: 0b

module version 1
    00000000: 00 61 73 6d 01 00 00 00

Type Section (id=1)
    00000008: 01 0d 03 60 00 01 7c 60 00 01 7c 60 00 01 7c
    [0] func_type: () => f64
    [1] func_type: () => f64
    [2] func_type: () => f64

Function Section (id=3)
    00000017: 03 04 03 00 01 02
    [0] type index: 0
    [1] type index: 1
    [2] type index: 2

Export Section (id=7)
    0000001d: 07 2e 03 06 67 65 74 4e 61 4e 00 00 0b 67 65 74
    0000002d: 49 6e 66 69 6e 69 74 79 00 01 13 67 65 74 4e 65
    0000003d: 67 61 74 69 76 65 49 6e 66 69 6e 69 74 79 00 02
    [0] 'getNaN' function index: 0
    [1] 'getInfinity' function index: 1
    [2] 'getNegativeInfinity' function index: 2

Code Section (id=10)
    0000004d: 0a 32 03 0c 00 44 01 00 00 00 00 00 f0 7f 0f 0b
    0000005d: 0c 00 44 00 00 00 00 00 00 f0 7f 0f 0b 16 00 44
    0000006d: 00 00 00 00 00 00 f0 bf 44 00 00 00 00 00 00 f0
    0000007d: 7f a2 0f 0b
    [0] export function 'getNaN': () => f64
        params:
        locals:
        code:
            f64.const 0x7ff0000000000001    // a constant value interpreted as f64
            return                          // return zero or one value from this function
            end                             // end a block, loop, or if
    [1] export function 'getInfinity': () => f64
        params:
        locals:
        code:
            f64.const 0x7ff0000000000000    // a constant value interpreted as f64
            return                          // return zero or one value from this function
            end                             // end a block, loop, or if
    [2] export function 'getNegativeInfinity': () => f64
        params:
        locals:
        code:
            f64.const 0xbff0000000000000    // a constant value interpreted as f64
            f64.const 0x7ff0000000000000    // a constant value interpreted as f64
            f64.mul                         // multiplication
            return                          // return zero or one value from this function
            end                             // end a block, loop, or if

