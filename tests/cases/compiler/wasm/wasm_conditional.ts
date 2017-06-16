//@target: wasm
//@outFile: out.wasm

export function ifStatementTest(a: number, b: number) { 
    let c = 0;
    if(a == b) {
        return a + b;
    }
    else if(a > b) {
        return a - b;
    }
    else {
        return a;
    }
}