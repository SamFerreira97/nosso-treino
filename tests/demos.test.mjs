import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import vm from 'node:vm';
import sharp from 'sharp';
const root=new URL('../public/',import.meta.url),mapping=JSON.parse(readFileSync(new URL('demos.json',root),'utf8'));
test('all 36 original exercises have an exact media mapping and retained attribution',async()=>{
  const names=vm.runInNewContext(readFileSync(new URL('data.js',root),'utf8')+'; PLAN.flatMap(d=>d[3].map(e=>e[0]));');
  assert.equal(mapping.length,36);assert.deepEqual([...mapping.map(m=>m[0])].sort(),[...names].sort());
  assert.ok(existsSync(new URL('demos/SOURCE-LICENSE.txt',root)));
  for(const [name,id]of mapping){
    const poster=await sharp(readFileSync(new URL('demos/'+id+'.jpg',root))).metadata();assert.ok(poster.width>=500,name);
    if(id==='Plank')continue;
    const gif=await sharp(readFileSync(new URL('demos/'+id+'.gif',root)),{animated:true}).metadata();
    assert.equal(gif.pages,2,name);assert.deepEqual(gif.delay,[1100,1100]);assert.equal(gif.loop,0);
    assert.ok(existsSync(new URL('demos/'+id+'-1.jpg',root)),name);
  }
});
