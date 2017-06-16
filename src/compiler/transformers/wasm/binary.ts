/**
 * Functions and types related to the WebAssembly binary representation, shared by
 * 'Encoder.ts' and 'Decoder.ts'.
 */

/* @internal */
namespace ts.wasm {
    /** Return the given number as an 8-bit/2-digit hexadecimal string. */
    export function hex8(value: number) {
        Debug.assert(is_int8(value) || is_uint8(value),
            "'value' must be an 8b signed or unsigned integer.", () => `got '${value}'`);
        const hex = (value & 0xFF).toString(16);
        return "00".substr(hex.length) + hex;
    }

    /** Return the given number as a 32-bit/8-digit hexadecimal string. */
    export function hex32(value: number) {
        Debug.assert(is_int32(value) || is_uint32(value),
            "'value' must be a 32b signed or unsigned integer.", () => `got '${value}'`);
        const hex = (value >>> 0).toString(16);
        return "00000000".substr(hex.length) + hex;
    }

    // Data Types

    /** True if the given number is an integer in the [0..1] range. */
    export function is_uint1(value: number) {
        return (value & 0x01) === value;
    }

    /** Asserts that the given number is an integer in the valid uint1 range. */
    export function assert_is_uint1(value: number) {
        Debug.assert(is_uint1(value), "'value' must be a uint1.", () => `got '${value}'`);
    }

    /** True if the given number is an integer in the [0..127] range. */
    export function is_uint7(value: number) {
        return (value & 0x7F) === value;
    }

    /** Asserts that the given number is an integer in the valid uint7 range. */
    export function assert_is_uint7(value: number) {
        Debug.assert(is_uint7(value), "'value' must be a uint7.", () => `got '${value}'`);
    }

    /** True if the given number is an integer in the [-64..63] range. */
    export function is_int7(value: number) {
        return ((value | 0) === value)              // Ensure 'value' is an integer
            && -0x40 <= value && value <= 0x3F;     //   and in the 7b range.
    }

    /** Asserts that the given number is an integer in the valid int7 range. */
    export function assert_is_int7(value: number) {
        Debug.assert(is_int7(value), "'value' must be a int7.", () => `got '${value}'`);
    }

    /** True if the given number is an integer in the [-128..127] range. */
    export function is_int8(value: number) {
        return ((value | 0) === value)              // Ensure 'value' is an integer
            && -128 <= value && value <= 127;       //   and in the 8b range.
    }

    /** True if the given number is an integer in the [0..255] range. */
    export function is_uint8(value: number) {
        return (value & 0xFF) === value;
    }

    /** Asserts that the given number is an integer in the valid uint8 range. */
    export function assert_is_uint8(value: number) {
        Debug.assert(is_uint8(value), "'value' must be a uint8.", () => `got '${value}'`);
    }

    /** True if the given number is an integer in the [-2147483648..2147483647] range. */
    export function is_int32(value: number) {
        return (value | 0) === value;       // JavaScript idiom to coerce number to signed 32b.
    }

    /** Asserts that the given number is an integer in the valid int32 range. */
    export function assert_is_int32(value: number) {
        Debug.assert(is_int32(value), "'value' must be a int32.", () => `got '${value}'`);
    }

    /** True if the given number is an integer in the [0..4294967295] range. */
    export function is_uint32(value: number) {
        return (value >>> 0) === value;     // JavaScript idiom to coerce number to unsigned 32b.
    }

    /** Asserts that the given number is an integer in the valid uint32 range. */
    export function assert_is_uint32(value: number) {
        Debug.assert(is_uint32(value), "'value' must be a uint32.", () => `got '${value}'`);
    }

    /** Wrapper around Debug.assert() to provide a helper assertion message for invalid enum values.
        'name' is the name of the enum type.  'predicate' is the function used to test the validity
        of the 'value'. */
    function assert_valid_enum_value<T>(name: string, predicate: (value: T) => boolean, value: T) {
        Debug.assert(predicate(value),
            "'value' must be a valid member of the enumeration.", () => `'${value}' is not a member of ${name}.`);
    }

    // Instruction Opcodes

    /** Asserts that the given 'op' is a valid opcode. */
    export function assert_is_opcode(op: opcode) {
        assert_valid_enum_value("opcode", value => opcode[value] !== undefined, op);
    }

    // Language Types

    /** All types are distinguished by a negative varint7 values that is the first
        byte of their encoding (representing a type constructor). */
    export enum type {
        i32 = -0x01,
        i64 = -0x02,
        f32 = -0x03,
        f64 = -0x04,
        anyfunc = -0x10,
        func = -0x20,
        emptyBlock = -0x40,
    }

    /** True if the given number is a valid value in the 'type' enum. */
    export function is_type(value: number) {
        switch (value) {
            case type.anyfunc:
            case type.func:
            case type.emptyBlock:
                return true;
            default:
                // All remaining 'type' values are members of the 'value_type' subset.
                return is_value_type(value);
        }
    }

    /** Casts the given number to a type, asserting it is a valid enum value. */
    export function to_type(value: number) {
        assert_valid_enum_value("type", is_type, value);
        return <type>value;
    }

    /** A varint7 indicating a value type. */
    export enum value_type {
        i32 = type.i32,
        i64 = type.i64,
        f32 = type.f32,
        f64 = type.f64,
    }

    /** True if the given number is a valid value in the 'value_type' enum. */
    export function is_value_type(value: number) {
        // Valid 'value_type' values are consecutive in the [-4..-1] range.
        return value_type.f64 <= value && value <= value_type.i32;
    }

    /** Casts the given number to a value_type, asserting it is a valid enum value. */
    export function to_value_type(value: number) {
        assert_valid_enum_value("value_type", is_value_type, value);
        return <value_type>value;
    }

    /** The description of a function signature. */
    export class FuncType {
        constructor (readonly param_types: value_type[], readonly return_types: value_type[]) {
            // Note: In the future, return_count and return_type might be generalized to allow multiple values.
            Debug.assert(0 <= return_types.length && return_types.length <= 1,
                "'func_type' must have 0 or 1 return values.", () => `got '${return_types.length}'`);
        }
    }

    // Other Types

    /** A single-byte unsigned integer indicating the kind of definition being imported or defined. */
    export enum external_kind {
        Function = 0,   // indicating a Function import or definition
        Table = 1,      // indicating a Table import or definition
        Memory = 2,     // indicating a Memory import or definition
        Global = 3,     // indicating a Global import or definition
    }

    /** True if the given number is a valid value in the 'value_type' enum. */
    export function is_external_kind(value: number) {
        // Valid 'external_kind' values are consecutive in the [0..3] range.
        return external_kind.Function <= value && value <= external_kind.Global;
    }

    /** Casts the given number to an external_kind, asserting it is a valid enum value. */
    export function to_external_kind(value: number) {
        assert_valid_enum_value("external_kind", is_external_kind, value);
        return <external_kind>value;
    }

    /** JavaScript only supports 53 bit integers so these 64 bit constants must 
     *  be represented by two variables.
    */
    export const binary_NaN_high = 0x7FF00000;
    export const binary_NaN_low = 0x00000001;
    export const binary_Infinity_high = 0x7FF00000;
    export const binary_Infinity_low = 0x00000000;

    export function is_NaN(lowBytes : number, highBytes : number) {
        return (lowBytes == binary_NaN_low && highBytes == binary_NaN_high);
    }

    export function is_Infinity(lowBytes : number, highBytes : number) {
        return (lowBytes == binary_Infinity_low && highBytes == binary_Infinity_high);
    }

    // Module Structure

    /** The module starts with a preamble  */
    export class Preamble {
        readonly magic_number = 0x6d736100;             // Magic number (i.e., '\0asm')

        constructor (readonly version: number) {
            switch (this.version) {
                case WasmVersion.Mvp:
                    break;
                default:
                    Debug.fail(`Unsupported WebAssembly version in module preamble: '0x${hex32(version)}'`);
                    break;
            }
        }
    }

    /** Each section [in a WebAssembly module] is identified by a 1-byte section code that encodes either
        a known section or a custom section. */
    export enum section_code {
        Custom = 0,     // Custom
        Type = 1,       // Function signature declarations
        Import = 2,     // Import declarations
        Function = 3,   // Function declarations
        Table = 4,      // Indirect function table and other tables
        Memory = 5,     // Memory attributes
        Global = 6,     // Global declarations
        Export = 7,     // Exports
        Start = 8,      // Start function declaration
        Element = 9,    // Elements section
        Code = 10,      // Function bodies (code)
        Data = 11,      // Data segments
    }

    /** True if the given number is a valid value in the 'section_code' enum. */
    export function is_section_code(value: number) {
        // Valid 'section_code' values are consecutive in the [0..11] range.
        return section_code.Custom <= value && value <= section_code.Data;
    }

    /** Casts the given number to a section_code, asserting it is a valid enum value. */
    export function to_section_code(value: number) {
        assert_valid_enum_value("section_code", is_section_code, value);
        return <section_code>value;
    }
    /** Base class for WebAssembly module sections */
    export class Section {
        constructor (readonly id: section_code) { }
    }

    /** Custom sections are ignored by the WebAssembly implementation, and thus validation
        errors within them do not invalidate a module.

        Custom sections all have the same id, and can be named non-uniquely (all bytes composing
        their names can be identical). */
    export class CustomSection extends Section {
        constructor (readonly name: string, readonly payload_data: number[]) {
            super(section_code.Custom);
        }
    }

    /** The type section declares all function signatures that will be used in the module. */
    export class TypeSection extends Section {
        readonly entries: FuncType[] = [];

        constructor () { super(section_code.Type); }

        public add(signature: FuncType) {
            const index = this.entries.length;
            this.entries.push(signature);
            return index;
        }
    }
    /** The function section declares the signatures of all functions in the module (their
        definitions appear in the code section). */
    export class FunctionSection extends Section {
        readonly types: number[] = [];      // varuint32*   sequence of indices into the type section

        constructor () { super(section_code.Function); }

        /** @param index Index of signature in types section */
        public add(index: number) {
            assert_is_uint32(index);
            const functionIndex = this.types.length;
            this.types.push(index);
            return functionIndex;
        }
    }

    /** Each export has three fields: a name, whose meaning is defined by the host environment, a type,
        indicating whether the export is a function, global, memory or table, and an index into the
        type’s corresponding index space. */
    export class ExportEntry {
        readonly kind: external_kind;

        /** For example, if the “kind” is Function, then “index” is a function index. */
        constructor (readonly name: string, kind: external_kind, readonly index: number) {
            assert_is_uint32(index);
            this.kind = to_external_kind(kind);     // Assert that 'kind' is a valid enum value.
            Debug.assert(index === 0 || kind !== external_kind.Global && kind !== external_kind.Memory,
                "In the MVP, the only valid index value for a memory or table export is 0.");
        }
    }

    /** A sequence of exports which are returned at instantiation time to the host environment. */
    export class ExportSection extends Section {
        readonly entries: ExportEntry[] = [];

        constructor () { super(section_code.Export); }

        public add(entry: ExportEntry) {
            this.entries.push(entry);
        }
    }

    /** The code section contains a body for every function in the module. The count of functions
        declared in the function section and function bodies defined in this section must be the
        same and the ith declaration corresponds to the ith function body. */
    export class CodeSection extends Section {
        readonly bodies: FunctionBody[] = [];       // function_body*   sequence of Function Bodies

        constructor () { super(section_code.Code); }

        public add(body: FunctionBody) {
            this.bodies.push(body);
        }
    }

    // Function Bodies

    /** Function bodies consist of a sequence of local variable declarations followed by bytecode instructions.
        It is legal to have several local entries with the same type.  Each function body must end with the end
        opcode. */
    export class FunctionBody {
        constructor (readonly locals: LocalEntry[], readonly code: number[]) {
            Debug.assert(code.length > 0,
                "'code' must terminate with the 'end' opcode (0x0b).  got zero bytes.");
            Debug.assert(code[code.length - 1] === opcode.end,
                "'code' must terminate with the 'end' opcode (0x0b).", () => `got '0x${hex8(code[code.length - 1])}'`);
        }
    }

    /** Each local entry declares a number of local variables of a given type. */
    export class LocalEntry {
        readonly type: value_type;
        constructor (readonly count: number, type: value_type) {
            assert_is_uint32(count);
            this.type = to_value_type(type);    // Assert 'type' is a valid 'value_type'.
        }
    }

    export enum opcode {

        // Control flow operators

        unreachable     = 0x00,     //                                  trap immediately
        nop             = 0x01,     //                                  no operation
        block           = 0x02,     // sig : block_type                 begin a sequence of expressions, yielding 0 or 1 values
        loop            = 0x03,     // sig : block_type                 begin a block which can also form control flow loops
        if              = 0x04,     // sig : block_type                 begin if expression
        else            = 0x05,     //                                  begin else expression of if
        end             = 0x0b,     //                                  end a block, loop, or if
        br              = 0x0c,     // relative_depth : varuint32       break that targets an outer nested block
        br_if           = 0x0d,     // relative_depth : varuint32       conditional break that targets an outer nested block
        br_table        = 0x0e,     // see below                        branch table control flow construct
        return          = 0x0f,     //                                  return zero or one value from this function

        // Call operators

        call            = 0x10,     // function_index : varuint32                       call a function by its index
        call_indirect   = 0x11,     // type_index : varuint32, reserved : varuint1      call a function indirect with an expected signature

        // Parametric operators

        drop            = 0x1a,     //                                  ignore value
        select          = 0x1b,     //                                  select one of two values based on condition

        get_local       = 0x20,     // local_index : varuint32          read a local variable or parameter
        set_local       = 0x21,     // local_index : varuint32          write a local variable or parameter
        tee_local       = 0x22,     // local_index : varuint32          write a local variable or parameter and return the same value
        get_global      = 0x23,     // global_index : varuint32         read a global variable
        set_global      = 0x24,     // global_index : varuint32         write a global variable

        // Memory-related operators (described here)

        i32_load        = 0x28,     // memory_immediate                 load from memory
        i64_load        = 0x29,     // memory_immediate                 load from memory
        f32_load        = 0x2a,     // memory_immediate                 load from memory
        f64_load        = 0x2b,     // memory_immediate                 load from memory
        i32_load8_s     = 0x2c,     // memory_immediate                 load from memory
        i32_load8_u     = 0x2d,     // memory_immediate                 load from memory
        i32_load16_s    = 0x2e,     // memory_immediate                 load from memory
        i32_load16_u    = 0x2f,     // memory_immediate                 load from memory
        i64_load8_s     = 0x30,     // memory_immediate                 load from memory
        i64_load8_u     = 0x31,     // memory_immediate                 load from memory
        i64_load16_s    = 0x32,     // memory_immediate                 load from memory
        i64_load16_u    = 0x33,     // memory_immediate                 load from memory
        i64_load32_s    = 0x34,     // memory_immediate                 load from memory
        i64_load32_u    = 0x35,     // memory_immediate                 load from memory
        i32_store       = 0x36,     // memory_immediate                 store to memory
        i64_store       = 0x37,     // memory_immediate                 store to memory
        f32_store       = 0x38,     // memory_immediate                 store to memory
        f64_store       = 0x39,     // memory_immediate                 store to memory
        i32_store8      = 0x3a,     // memory_immediate                 store to memory
        i32_store16     = 0x3b,     // memory_immediate                 store to memory
        i64_store8      = 0x3c,     // memory_immediate                 store to memory
        i64_store16     = 0x3d,     // memory_immediate                 store to memory
        i64_store32     = 0x3e,     // memory_immediate                 store to memory
        current_memory  = 0x3f,     // reserved : varuint1              query the size of memory
        grow_memory     = 0x40,     // reserved : varuint1              grow the size of memory

        // Constants

        i32_const       = 0x41,     // value : varint32                 a constant value interpreted as i32
        i64_const       = 0x42,     // value : varint64                 a constant value interpreted as i64
        f32_const       = 0x43,     // value : uint32                   a constant value interpreted as f32
        f64_const       = 0x44,     // value : uint64                   a constant value interpreted as f64

        // Comparison operators

        i32_eqz         = 0x45,     // compare equal to zero (return 1 if operand is zero, 0 otherwise)
        i32_eq          = 0x46,     // sign-agnostic compare equal
        i32_ne          = 0x47,     // sign-agnostic compare unequal
        i32_lt_s        = 0x48,     // signed less than
        i32_lt_u        = 0x49,     // unsigned less than
        i32_gt_s        = 0x4a,     // signed greater than
        i32_gt_u        = 0x4b,     // unsigned greater than
        i32_le_s        = 0x4c,     // signed less than or equal
        i32_le_u        = 0x4d,     // unsigned less than
        i32_ge_s        = 0x4e,     // signed greater than or equal
        i32_ge_u        = 0x4f,     // unsigned greater than or equal
        i64_eqz         = 0x50,     // compare equal to zero (return 1 if operand is zero, 0 otherwise)
        i64_eq          = 0x51,     // sign-agnostic compare equal
        i64_ne          = 0x52,     // sign-agnostic compare unequal
        i64_lt_s        = 0x53,     // signed less than
        i64_lt_u        = 0x54,     // unsigned less than
        i64_gt_s        = 0x55,     // signed greater than
        i64_gt_u        = 0x56,     // unsigned greater than
        i64_le_s        = 0x57,     // signed less than or equal
        i64_le_u        = 0x58,     // unsigned less than
        i64_ge_s        = 0x59,     // signed greater than or equal
        i64_ge_u        = 0x5a,     // unsigned greater than or equal
        f32_eq          = 0x5b,     // compare ordered and equal
        f32_ne          = 0x5c,     // compare unordered or unequal
        f32_lt          = 0x5d,     // compare ordered and less than
        f32_gt          = 0x5e,     // compare ordered and greater than
        f32_le          = 0x5f,     // compare ordered and less than or equal
        f32_ge          = 0x60,     // compare ordered and greater than or equal
        f64_eq          = 0x61,     // compare ordered and equal
        f64_ne          = 0x62,     // compare unordered or unequal
        f64_lt          = 0x63,     // compare ordered and less than
        f64_gt          = 0x64,     // compare ordered and greater than
        f64_le          = 0x65,     // compare ordered and less than or equal
        f64_ge          = 0x66,     // compare ordered and greater than or equal

        // Numeric operators

        i32_clz         = 0x67,     // sign-agnostic count leading zero bits (All zero bits are considered leading if the value is zero)
        i32_ctz         = 0x68,     // sign-agnostic count trailing zero bits (All zero bits are considered trailing if the value is zero)
        i32_popcnt      = 0x69,     // sign-agnostic count number of one bits
        i32_add         = 0x6a,     // sign-agnostic addition
        i32_sub         = 0x6b,     // sign-agnostic subtraction
        i32_mul         = 0x6c,     // sign-agnostic multiplication (lower 32-bits)
        i32_div_s       = 0x6d,     // signed division (result is truncated toward zero)
        i32_div_u       = 0x6e,     // unsigned division (result is floored)
        i32_rem_s       = 0x6f,     // signed remainder (result has the sign of the dividend)
        i32_rem_u       = 0x70,     // unsigned remainder
        i32_and         = 0x71,     // sign-agnostic bitwise and
        i32_or          = 0x72,     // sign-agnostic bitwise inclusive or
        i32_xor         = 0x73,     // sign-agnostic bitwise exclusive or
        i32_shl         = 0x74,     // sign-agnostic shift left
        i32_shr_s       = 0x75,     // zero-replicating (logical) shift right
        i32_shr_u       = 0x76,     // sign-replicating (arithmetic) shift right
        i32_rotl        = 0x77,     // sign-agnostic rotate left
        i32_rotr        = 0x78,     // sign-agnostic rotate right
        i64_clz         = 0x79,     // sign-agnostic count leading zero bits (All zero bits are considered leading if the value is zero)
        i64_ctz         = 0x7a,     // sign-agnostic count trailing zero bits (All zero bits are considered trailing if the value is zero)
        i64_popcnt      = 0x7b,     // sign-agnostic count number of one bits
        i64_add         = 0x7c,     // sign-agnostic addition
        i64_sub         = 0x7d,     // sign-agnostic subtraction
        i64_mul         = 0x7e,     // sign-agnostic multiplication (lower 32-bits)
        i64_div_s       = 0x7f,     // signed division (result is truncated toward zero)
        i64_div_u       = 0x80,     // unsigned division (result is floored)
        i64_rem_s       = 0x81,     // signed remainder (result has the sign of the dividend)
        i64_rem_u       = 0x82,     // unsigned remainder
        i64_and         = 0x83,     // sign-agnostic bitwise and
        i64_or          = 0x84,     // sign-agnostic bitwise inclusive or
        i64_xor         = 0x85,     // sign-agnostic bitwise exclusive or
        i64_shl         = 0x86,     // sign-agnostic shift left
        i64_shr_s       = 0x87,     // zero-replicating (logical) shift right
        i64_shr_u       = 0x88,     // sign-replicating (arithmetic) shift right
        i64_rotl        = 0x89,     // sign-agnostic rotate left
        i64_rotr        = 0x8a,     // sign-agnostic rotate right
        f32_abs         = 0x8b,     // absolute value
        f32_neg         = 0x8c,     // negation
        f32_ceil        = 0x8d,     // ceiling operator
        f32_floor       = 0x8e,     // floor operator
        f32_trunc       = 0x8f,     // round to nearest integer towards zero
        f32_nearest     = 0x90,     // round to nearest integer, ties to even
        f32_sqrt        = 0x91,     // square root
        f32_add         = 0x92,     // addition
        f32_sub         = 0x93,     // subtraction
        f32_mul         = 0x94,     // multiplication
        f32_div         = 0x95,     // division
        f32_min         = 0x96,     // minimum (binary operator); if either operand is NaN, returns NaN
        f32_max         = 0x97,     // maximum (binary operator); if either operand is NaN, returns NaN
        f32_copysign    = 0x98,     // copysign
        f64_abs         = 0x99,     // absolute value
        f64_neg         = 0x9a,     // negation
        f64_ceil        = 0x9b,     // ceiling operator
        f64_floor       = 0x9c,     // floor operator
        f64_trunc       = 0x9d,     // round to nearest integer towards zero
        f64_nearest     = 0x9e,     // round to nearest integer, ties to even
        f64_sqrt        = 0x9f,     // square root
        f64_add         = 0xa0,     // addition
        f64_sub         = 0xa1,     // subtraction
        f64_mul         = 0xa2,     // multiplication
        f64_div         = 0xa3,     // division
        f64_min         = 0xa4,     // minimum (binary operator); if either operand is NaN, returns NaN
        f64_max         = 0xa5,     // maximum (binary operator); if either operand is NaN, returns NaN
        f64_copysign    = 0xa6,     // copysign

        // Conversions

        i32_wrap_i64        = 0xa7,     // wrap a 64-bit integer to a 32-bit integer
        i32_trunc_s_f32     = 0xa8,     // truncate a 32-bit float to a signed 32-bit integer
        i32_trunc_u_f32     = 0xa9,     // truncate a 32-bit float to an unsigned 32-bit integer
        i32_trunc_s_f64     = 0xaa,     // truncate a 64-bit float to a signed 32-bit integer
        i32_trunc_u_f64     = 0xab,     // truncate a 64-bit float to an unsigned 32-bit integer
        i64_extend_s_i32    = 0xac,     // extend a signed 32-bit integer to a 64-bit integer
        i64_extend_u_i32    = 0xad,     // extend an unsigned 32-bit integer to a 64-bit integer
        i64_trunc_s_f32     = 0xae,     // truncate a 32-bit float to a signed 64-bit integer
        i64_trunc_u_f32     = 0xaf,     // truncate a 32-bit float to an unsigned 64-bit integer
        i64_trunc_s_f64     = 0xb0,     // truncate a 64-bit float to a signed 64-bit integer
        i64_trunc_u_f64     = 0xb1,     // truncate a 64-bit float to an unsigned 64-bit integer
        f32_convert_s_i32   = 0xb2,     // convert a signed 32-bit integer to a 32-bit float
        f32_convert_u_i32   = 0xb3,     // convert an unsigned 32-bit integer to a 32-bit float
        f32_convert_s_i64   = 0xb4,     // convert a signed 64-bit integer to a 32-bit float
        f32_convert_u_i64   = 0xb5,     // convert an unsigned 64-bit integer to a 32-bit float
        f32_demote_f64      = 0xb6,     // demote a 64-bit float to a 32-bit float
        f64_convert_s_i32   = 0xb7,     // convert a signed 32-bit integer to a 64-bit float
        f64_convert_u_i32   = 0xb8,     // convert an unsigned 32-bit integer to a 64-bit float
        f64_convert_s_i64   = 0xb9,     // convert a signed 64-bit integer to a 64-bit float
        f64_convert_u_i64   = 0xba,     // convert an unsigned 64-bit integer to a 64-bit float
        f64_promote_f32     = 0xbb,     // promote a 32-bit float to a 64-bit float

        // Reinterpretations

        i32_reinterpret_f32 = 0xbc,     // reinterpret the bits of a 32-bit float as a 32-bit integer
        i64_reinterpret_f64 = 0xbd,     // reinterpret the bits of a 64-bit float as a 64-bit integer
        f32_reinterpret_i32 = 0xbe,     // reinterpret the bits of a 32-bit integer as a 32-bit float
        f64_reinterpret_i64 = 0xbf,     // reinterpret the bits of a 64-bit integer as a 64-bit float
    }
}
