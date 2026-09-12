import fs from 'node:fs';
const file='artifacts/electronics-inventory/src/App.tsx';
let source=fs.readFileSync(file,'utf8');
const routePattern=/<Route\s+path=["']\/sales\/checkout\/:id["'][^>]*\/>/;
if(routePattern.test(source)){
  source=source.replace(routePattern,'<Route path="/sales/checkout" component={SalesCheckoutPage}/><Route path="/sales/checkout/:id" component={SalesCheckoutPage}/>');
}else if(!source.includes('path="/sales/checkout"')){
  const switchClose=source.lastIndexOf('</Switch>');
  if(switchClose<0) throw new Error('Router Switch boundary not found');
  source=source.slice(0,switchClose)+'<Route path="/sales/checkout" component={SalesCheckoutPage}/><Route path="/sales/checkout/:id" component={SalesCheckoutPage}/>'+source.slice(switchClose);
}
fs.writeFileSync(file,source);
console.log('Sales cart routes ensured.');
