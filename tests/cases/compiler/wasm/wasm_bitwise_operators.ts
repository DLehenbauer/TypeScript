//@target: wasm
//@outFile: out.wasm

export function bitOR(a: number, b: number) { return a | b; }
export function bitAND(a: number, b:number) {return a & b; }
export function bitXOR(a: number, b: number) {return a ^ b; }
export function bitLeftShift(a: number, b: number) {return a << b;}
export function bitRightShift(a: number, b: number) {return a >> b;}