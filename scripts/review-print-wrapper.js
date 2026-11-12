/* Private review only. Print the active page in the top document, not a clipped iframe.
 * Candidate scripts, text and styles remain intact inside the review frame.
 * Never call print() from beforeprint: Chrome already owns that print request.
 */
(() => {
  'use strict';
  const frame=document.getElementById('site-preview');
  let active=null,afterCount=0;
  function install(){
    const child=frame.contentWindow;
    child.addEventListener('afterprint',()=>afterCount++);
    // A report's own button follows the same top-level route as browser Ctrl+P.
    child.print=()=>window.print();
  }
  frame.addEventListener('load',install);
  if(frame.contentDocument?.readyState==='complete' && frame.contentDocument.querySelector('main'))install();
  window.addEventListener('beforeprint',()=>{
    if(active)return;
    const child=frame.contentWindow,doc=frame.contentDocument;
    if(!doc?.body)return;
    active={child,afterCount,bodyClass:document.body.className,focus:document.activeElement,nodes:[],styles:[]};
    // Parent beforeprint precedes the browser's child events. Prepare the chosen
    // report before copying it; the candidate's handler is safe to repeat.
    child.dispatchEvent(new child.Event('beforeprint'));
    for(const source of doc.querySelectorAll('head style')){
      const style=source.cloneNode(true);style.media='print';
      document.head.append(style);active.styles.push(style);
    }
    document.body.className=doc.body.className+' review-printing';
    const report=doc.getElementById('search-print-output');
    const content=report?[report]:[...doc.body.children].filter(n=>!['SCRIPT','STYLE'].includes(n.tagName));
    for(const source of content){
      const copy=source.cloneNode(true);copy.dataset.reviewPrintCopy='';
      copy.querySelectorAll('script').forEach(n=>n.remove());
      document.body.append(copy);active.nodes.push(copy);
    }
    const guard=document.createElement('style');
    guard.textContent='@media screen{[data-review-print-copy]{display:none!important}}@media print{body.review-printing> :not([data-review-print-copy]){display:none!important}body.review-printing{margin:0!important;padding:0!important;background:white!important}}';
    document.head.append(guard);active.styles.push(guard);
  });
  window.addEventListener('afterprint',()=>{
    if(!active)return;
    const done=active;active=null;
    done.nodes.forEach(n=>n.remove());done.styles.forEach(n=>n.remove());
    document.body.className=done.bodyClass;
    // Chromium normally sends afterprint to the child too. The deferred fallback
    // restores the candidate if a browser omits it, without sending it twice.
    setTimeout(()=>{
      if(done.child===frame.contentWindow && afterCount===done.afterCount)done.child.dispatchEvent(new done.child.Event('afterprint'));
      if(done.focus?.isConnected && done.focus!==frame)done.focus.focus({preventScroll:true});
    },0);
  });
})();
