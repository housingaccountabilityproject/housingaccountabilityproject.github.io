import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Keep page/text/annotation assertions independent from the website renderer.
export function execPDF(command,args,options={}) {
 return execFileSync(process.env.PDF_TEST_PYTHON||'python3',[fileURLToPath(new URL('./read-test-pdf.py',import.meta.url)),command,...args],options);
}
