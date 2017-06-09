/// <reference path="binary.ts" />

/* @internal */
namespace ts.wasm {
    /**
     * Binary encoder for writing WebAssembly modules.
     */
    export class Encoder {
        private _buffer: number[] = [];

        /** Float64Array used by 'float64()' to extract bytes representation of a 64b float. */
        private f64Buffer = new Float64Array(1);

        /** Returns the array of bytes containing the encoded WebAssembly module. */
        public get buffer() { return this._buffer; }

        /** View of 'f64Buffer' used by 'float64()' to extract bytes representation of a 64b float. */
        private f64Bytes = new DataView(this.f64Buffer.buffer);

        // Data Types

        /** Write the given unsigned 8b integer, as-is. */
        public uint8(u8: number) {
            assert_is_uint8(u8);
            this._buffer.push(u8);
        }

        /** Write the given sequence of bytes, as-is. */
        public bytes(bytes: number[]) {
            bytes.forEach(byte => { assert_is_uint8(byte); });

            this._buffer = this._buffer.concat(bytes);
        }

        /** Write the given unsigned 32b integer as 4-bytes (little-endian). */
        public uint32(u32: number) {
            assert_is_uint32(u32);
            this.uint8(u32 & 0xFF);                              // Emit each byte in little-endian order.
            this.uint8((u32 >>> 8) & 0xFF);
            this.uint8((u32 >>> 16) & 0xFF);
            this.uint8((u32 >>> 24) & 0xFF);
        }

        public float64(f64: number) {
            this.f64Buffer[0] = f64;
            this.uint32(this.f64Bytes.getUint32(0, /* little-endian */ true));  // Emit bytes 0-3
            this.uint32(this.f64Bytes.getUint32(4, /* little-endian */ true));  // Emit bytes 4-7
        }

        

        /** Write an unsigned 32b integer as LEB128. */
        public varuint32(u32: number) {
            assert_is_uint32(u32);
            for (; u32 >= 0x80; u32 >>>= 7) {                   // While more than 7-bits remain, emit/remove the next 7-bits
                this.uint8(0x80 | (u32 & 0x7F));                // with the msb of the byte set to indicate more bytes remain.
            }
            this.uint8(u32);                                    // Emit the remaining bits with the msb clear to indicate the end.
        };

        /** Write an unsigned 7b integer as LEB128. */
        public varuint7(u7: number) {
            assert_is_uint7(u7);
            this.uint8(u7);                                      // (See last byte emitted by 'varuint32' above.)
        }

        /** Write an unsigned 1b integer as LEB128. */
        public varuint1(u1: number) {
            assert_is_uint1(u1);
            this.uint8(u1);                                      // (See last byte emitted by 'varuint32' above.)
        }

        /** Write a signed 32b integer as LEB128. */
        public varint32(s32: number) {
            assert_is_int32(s32);
            for (; s32 < -0x40 || s32 > 0x3F; s32 >>= 7) {      // While more than 6-bits + sign bit remain, emit/remove
                this.uint8(0x80 | (s32 & 0x7F));                // the next 7-bits with the msb set to indicate more bytes
            }                                                   // remain.
            this.uint8(s32 & 0x7F);                             // Emit the last 6-bits + sign bit with a clear msb to signal
        }                                                       // the end.

        /** Write a signed 7b integer as LEB128. */
        public varint7(s7: number) {
            assert_is_int7(s7);
            this.uint8(s7 & 0x7F);                              // (See last byte emitted by 'varint32' above.)
        }

        /** Write a byte-length prefixed UTF-8 encoded string. */
        public utf8(str: string) {
            const encoder = new Encoder();
            const numCodeUnits = str.length;

            for (let i = 0; i < numCodeUnits; i++) {
                const codeUnit = str.charCodeAt(i);
                // TODO: Support full UTF-8.
                //       https://github.com/DLehenbauer/TypeScript/issues/2
                Debug.assert(codeUnit < 0x80,
                    "Full UTF-8 support is not yet implemented.");
                encoder.uint8(codeUnit);
            }

            this.varuint32(encoder.buffer.length);      // varuint32       byte length of following utf8 encoded string.
            this.bytes(encoder.buffer);                 // bytes           utf8 encoded string.
        }

        // Instruction Opcodes

        /** Write an 'opcode', asserting it is a valid value in the enum. */
        public op(op: opcode) {
            assert_is_opcode(op);

            // In the MVP, the opcodes of instructions are all encoded in a single byte since there are fewer than 256 opcodes.
            // Future features like SIMD and atomics will bring the total count above 256 and so an extension scheme will be
            // necessary, designating one or more single-byte values as prefixes for multi-byte opcodes.
            this.uint8(op);
        }

        // Language Types

        /** Write a 'type' as a varint7, asserting it is a valid value in the enum. */
        public type(type: type) { this.varint7(to_type(type)); }

        /** Write a 'value_type' as a varint7, asserting it is a valid value in the enum. */
        public value_type(type: value_type) { this.varint7(to_value_type(type)); }

        /** Write a 'func_type'. */
        public func_type(func: FuncType) {
            this.type(type.func);                                           // varint7      the value for the func type constructor (i.e., type.func)
            this.varuint32(func.param_types.length);                        // varuint32    the number of parameters to the function
            func.param_types.forEach(item => this.value_type(item));        // value_type*  the parameter types of the function

            // Note: In the future, return_count and return_type might be generalized to allow multiple values.
            this.varuint1(func.return_types.length);                        // varuint1     the number of results from the function
            func.return_types.forEach(item => this.value_type(item));       // value_type   the result type of the function (if return_count is 1)
        }

        // Other Types

        /** Write an 'external_kind' as a uint8, asserting it is a valid value in the enum. */
        public external_kind(kind: external_kind) { this.uint8(to_external_kind(kind)); }

        // Module Structure

        /** Write the 'module_preamble'. */
        public module_preamble(preamble: Preamble) {
            this.uint32(preamble.magic_number);         // uint32       Magic number 0x6d736100 (i.e., '\0asm')
            this.uint32(preamble.version);              // uint32       Version number
        }

        /** Write a 'section_code' as a varuint7, asserting it is a valid value in the enum. */
        public section_code(code: section_code) { this.varuint7(to_section_code(code)); }

        /**
         * Helper that invokes 'getPayload' with a nested 'payloadEncoder' to get the section's payload_data'.
         * It then writes the given 'id', 'payload_len', and 'payload_data'.  Can be used for custom sections
         * by including the 'name_len' and 'name' in the 'payload_data'.
         *
         * 'elideIfEmpty' determines whether empty sections are encoded, or are elided from the wasm module.
         * (Generally, you want to elide them.  The option to include empty sections is currently only supported
         * so we can test that the decoder successfully decodes empty sections, as empty sections are permitted
         * by the spec.)
         */
        private section<T extends Section>(section: T, getPayload: (payloadEncoder: Encoder) => boolean, elideIfEmpty: boolean) {
            const payload = new Encoder();
            const hasEntries = getPayload(payload);
            if (!hasEntries && elideIfEmpty) {
                return false;
            }

            this.section_code(section.id);              // varuint7     section code
            this.varuint32(payload.buffer.length);      // varuint32    size of this section in bytes
            this.bytes(payload.buffer);                 // (name_len, name, and payload_data)
            return hasEntries;
        }

        /** Write the given custom section.  */
        public custom_section(custom: CustomSection, elideIfEmpty: boolean) {
            return this.section(custom, encoder => {
                // Note: At this point we know we are encoding a custom section (i.e., id = 0), so
                //       the following two fields are not optional.
                encoder.utf8(custom.name);              // varuint32?   length of the section name in bytes, present if id == 0
                                                        // bytes?       section name string, present if id == 0
                encoder.bytes(custom.payload_data);     // bytes        content of this section, of length

                // We assume that the existence of a custom section potentially has meaning, even if the
                // name/bytes are empty.  Therefore we return 'true' to indicate that this section should
                // always be emitted.
                return true;
            }, elideIfEmpty);
        }

        /** Validates that the 'encoder' length matches the expected value when 'hasEntries' indicates the section was empty. */
        private checkSectionHasEntries(hasEntries: boolean, encoder: Encoder, expectedEmptyLength: number) {
            Debug.assert(hasEntries !== (encoder.buffer.length === expectedEmptyLength),
                'Encoded payload of empty section must match expected length',
                () => `Expected ${expectedEmptyLength}, but got ${encoder.buffer.length}`);
            return hasEntries;
        }

        /** Write the given type section. */
        public type_section(section: TypeSection, elideIfEmpty: boolean) {
            return this.section(section, encoder => {
                encoder.varuint32(section.entries.length);              // varuint32    count of type entries to follow
                section.entries.forEach(                                // func_type*   repeated type entries
                    signature => encoder.func_type(signature));
                return this.checkSectionHasEntries(section.entries.length > 0, encoder, /* expectedEmptyLength: */ 1);
            }, elideIfEmpty);
        }

        /** Write the given function section. */
        public function_section(section: FunctionSection, elideIfEmpty: boolean) {
            return this.section(section, encoder => {
                encoder.varuint32(section.types.length);                // varuint32    count of signature indices to follow
                section.types.forEach(type => {                         // varuint32*   sequence of indices into the type section
                    encoder.varuint32(type);
                });
                return this.checkSectionHasEntries(section.types.length > 0, encoder, /* expectedEmptyLength: */ 1);
            }, elideIfEmpty);
        }

        /** Write the given 'export section'. */
        public export_section(section: ExportSection, elideIfEmpty: boolean) {
            return this.section(section, encoder => {
                encoder.varint32(section.entries.length);               // varuint32        count of export entries to follow
                section.entries.forEach(                                // export_entry*    repeated export entries
                    item => encoder.export_entry(item));
                return this.checkSectionHasEntries(section.entries.length > 0, encoder, /* expectedEmptyLength: */ 1);
            }, elideIfEmpty);
        }

        /** Invoked by 'export_section()' to write the given 'export_entry'. */
        private export_entry(entry: ExportEntry) {
            this.utf8(entry.name);      // field_len       varuint32        field name string length
                                        // field_str       bytes            field name string of field_len bytes
            this.external_kind(entry.kind);             // external_kind    the kind of definition being exported
            this.varuint32(entry.index);                // varuint32        the index into the corresponding index space
        }

        /** Write the given 'code section'. */
        public code_section(section: CodeSection, elideIfEmpty: boolean) {
            return this.section(section, encoder => {
                encoder.varuint32(section.bodies.length);                       // varuint32        count of function bodies to follow
                section.bodies.forEach(body => encoder.function_body(body));    // function_body*   sequence of Function Bodies
                return this.checkSectionHasEntries(section.bodies.length > 0, encoder, /* expectedEmptyLength: */ 1);
            }, elideIfEmpty);
        }

        // Function Bodies

        /** Invoked by 'code_section()' to write the given 'function_body'. */
        private function_body(body: FunctionBody) {
            // To calculate the byte length of the function body, we encode the         // varuint32        size of function body to follow, in bytes
            // payload into a separate Encoder instance which is then concatenated
            // to this instance.
            const payload = new Encoder();

            payload.varuint32(body.locals.length);                                      // varuint32        number of local entries
            body.locals.forEach(item => payload.local_entry(item));                     // local_entry*     local variables
            payload.bytes(body.code);                                                   // byte*            bytecode of the function

            Debug.assert(payload.buffer[payload.buffer.length - 1] === opcode.end,      // byte             0x0b, indicating the end of the body
                "'code' must terminate with the 'end' opcode (0x0b).",
                () => `got '0x${hex32(payload.buffer[payload.buffer.length - 1])}.`);

            this.varuint32(payload.buffer.length);                                      // See above: byte size of function body
            this.bytes(payload.buffer);                                                 // See above: local_count, locals, code
        }

        /** Invoked by 'function_body()' to write the given 'local_entry'. */
        private local_entry(entry: LocalEntry) {
            this.varuint32(entry.count);    // varuint32    number of local variables of the following type
            this.value_type(entry.type);    // value_type   type of the variables
        }
    }

    /** Common base for encoding numeric operations. */
    export interface NumericOpEncoder {
        /** Push the immediate constant 'value' on to the stack. */
        const(value: number): void;

        /** Replace the top two values on the stack with their sum. */
        add(): void;

        /** Replace the top two values on the stack with their difference. */
        sub(): void;

        /** Replace the top two values on the stack with their product. */
        mul(): void;

        /** Replace the top two values on the stack with their quotient. */
        div(): void;

        /** Replace the top two values on the stack with an int32 denoting if the first value is greater than the second */
        comparisonGT(): void;

        /** Replace the top two values on the stack with an int32 denoting if the first value is less than the second */
        comparisonLT(): void;

        /** Replace the top two values on the stack with an int32 denoting if the two values are equal */
        equals(): void;

        /** Replace the top two values on the stack with an int32 denoting if the first value is greater
         *  than or equal to the second */
        comparisonGE(): void;

        /** Replace the top two values on the stack with an int32 denoting if the first value is less
         *  than or equal to the second */
        comparisonLE(): void;

    }

    /* Common base for 32 int numeric operations */
    export interface NumericOpEncoder32 {
        /** Push the immediate constant 'value' on to the stack. */
        const(value: number): void;

        /** Replace the top two values on the stack with their remainder. */
        rem(): void;

    }

    /** Private implementation of NumericOpEncoder for encoding operations on 64b floating point numbers. */
    class F64OpEncoder implements NumericOpEncoder {
        constructor (private encoder: RawOpEncoder) { }

        // NumericOpEncoder implementation
        const(value: number) { this.encoder.op_f64(opcode.f64_const, value); }
        add() { this.encoder.op(opcode.f64_add); }
        sub() { this.encoder.op(opcode.f64_sub); }
        mul() { this.encoder.op(opcode.f64_mul); }
        div() { this.encoder.op(opcode.f64_div); }
        comparisonGT() { this.encoder.op(opcode.f64_gt); }
        comparisonLT() { this.encoder.op(opcode.f64_lt); }
        equals() { this.encoder.op(opcode.f64_eq); }
        comparisonGE() { this.encoder.op(opcode.f64_ge); }
        comparisonLE() { this.encoder.op(opcode.f64_le); }
    }

    /** Private implementation of NumericOpEncoder32 for encoding operations on 32b integers. */
    class I320pEncoder implements NumericOpEncoder32 {
        constructor (private encoder: RawOpEncoder) {}

        // NumericOpEncoder32 implementation
        const(value: number) { this.encoder.op_i32(opcode.i32_const, value); }
        rem() { this.encoder.op(opcode.i32_rem_s); }
    }

    /** Internal wrapper around 'Encoder' that surfaces helpers for writing opcodes and immediates.
        Internally used by the public OpEncoder implementations, which expose methods to write specific
        opcodes. */
    class RawOpEncoder {
        private encoder: Encoder = new Encoder();

        /** Write the given opcode with no immediates. */
        public op(opcode: opcode) {
            this.encoder.op(opcode);
        }

        /** Write the given opcode with one varuint32 immediate. */
        public op_vu32(opcode: opcode, immediate: number) {
            this.encoder.op(opcode);
            this.encoder.varuint32(immediate);
        }

        /** Write the given opcode with one 64b floating point immediate. */
        public op_f64(opcode: opcode, f64: number) {
            this.encoder.op(opcode);
            this.encoder.float64(f64);
        }

        /** Write the given opcode with one 32b integer (non-floating type) immediate. */
        public op_i32(opcode: opcode, i32: number) {
            this.encoder.op(opcode);
            this.encoder.varint32(i32);
        }

        /** Returns the array of bytes containing the encoded byte code. */
        public get buffer() {
            return this.encoder.buffer;
        }
    }

    export class OpEncoder {
        private encoder: RawOpEncoder = new RawOpEncoder();

        /** Operators for 64b floating point numbers. */
        readonly f64: NumericOpEncoder = new F64OpEncoder(this.encoder);

        /** Operators for 32b integers */
        readonly i32: NumericOpEncoder32 = new I320pEncoder(this.encoder);

        /** Array of bytes containing the encoded opcodes and immediates. */
        public get buffer() { return this.encoder.buffer; }

        /** Return from the current function.  The caller receives the top 0 or 1 values from the stack,
            according to this function's 'func_type'. */
        public return() { this.encoder.op(opcode.return); }

        /** Designate the end of a block, loop, or if.

            Note: Function bodies are blocks, and must terminate with an end opcode.  This may initially
                  appear redundant with 'return'.  However, 'return' does not designate the end of a
                  function when a function has multiple return points. */
        public end() { this.encoder.op(opcode.end); }

        /** Push the local/function parameter with the given 'local_index' on to the stack. */
        public get_local(local_index: number) { this.encoder.op_vu32(opcode.get_local, local_index); }
    }
}