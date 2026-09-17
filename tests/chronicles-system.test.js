const test=require('node:test');
const assert=require('node:assert/strict');
const {summarize}=require('../chronicles-system.js');
test('the fate of the black tide and the final memory create four distinct campaign endings',()=>{
  const keys=new Set();
  for(const tide of ['shelter','steady'])for(const tree of ['rings','leaves']){
    const result=summarize({blackTide:{choice:tide},worldTree:{choice:tree}});
    assert.equal(result.complete,true);assert.equal(result.memories,2);keys.add(result.ending.key);
    assert.equal(result.ending.paragraphs.length,3);
  }
  assert.equal(keys.size,4);
});
test('unfinished and malformed records cannot unlock the epilogue, prior choices return as echoes',()=>{
  assert.equal(summarize({worldTree:{choice:'unknown'}}).complete,false);
  const result=summarize({groveGate:{choice:'both'},tideShrine:{choice:'name'},unknown:{choice:'north'}});
  assert.equal(result.memories,2);assert.equal(result.ending,null);assert.equal(result.echoes.length,2);
  assert.match(result.echoes[0].text,/小队/);
});
test('a returned epilogue cannot mutate subsequent journeys',()=>{
  const records={worldTree:{choice:'rings'}};summarize(records).ending.paragraphs[0]='changed';
  assert.notEqual(summarize(records).ending.paragraphs[0],'changed');
});
