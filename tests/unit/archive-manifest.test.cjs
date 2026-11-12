const {test}=require('node:test');const assert=require('node:assert/strict');const {safeName,validEntryName}=require('../../electron/features/archive/manifest.cjs');
test('safe archive names preserve Cyrillic and reject extraction attacks',()=>{
 assert.match(safeName('../пример.txt'),/пример/);assert.ok(!safeName('../пример.txt').includes('/'));
 for(const x of ['../x','/x','C:/x','a\\b','a/../b','a//b'])assert.equal(validEntryName(x),false);
 assert.equal(validEntryName('source/original.txt'),true);
});
