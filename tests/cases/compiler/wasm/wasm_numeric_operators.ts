//@target: wasm
//@outFile: out.wasm

export function add(a: number, b: number) { return a + b; }
export function sub(a: number, b: number) { return a - b; }
export function mul(a: number, b: number) { return a * b; }
export function div(a: number, b: number) { return a / b; }
export function precedence_mul_before_add(a: number, b: number, c: number) { return a * b + c; }
export function precedence_add_after_mul(a: number, b: number, c: number) { return a + b * c; }
export function precedence_parens(a: number, b: number, c: number) { return (a + b) * c; }
export function variableAssignment(a: number, b: number) {
    let c = a + b;
    let d = c / b;
    return d;
}
