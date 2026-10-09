// Local-only, read/lock test: no persistent writes, credentials or remote endpoint.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const args=['exec','-i','supabase_db_vacivitta','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
function connection(){
 const child=spawn('docker',args,{windowsHide:true,stdio:['pipe','pipe','pipe']});
 let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 const finished=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve({code,output}));});
 return {child,finished,get output(){return output;}};
}
const holder=connection();
const deadline=setTimeout(()=>holder.child.kill(),15000);
try {
 holder.child.stdin.write("begin; select pg_advisory_xact_lock(2727,1); select 'LOCK_READY';\n");
 const start=Date.now();while(!holder.output.includes('LOCK_READY')) {if(Date.now()-start>8000)throw Error('Local lock not acquired');await new Promise(r=>setTimeout(r,25));}
 for(const call of ["public.change_employee_security(null,'revoke')","public.change_employee_security(null,'deactivate')","public.send_message(null,'test')","public.accept_task(null)"]){
  const contender=connection();contender.child.stdin.end(`begin; set local role authenticated; set local lock_timeout='200ms'; select ${call}; rollback;\n`);
  const result=await contender.finished;assert.notEqual(result.code,0);assert.match(result.output,/lock timeout/);
 }
 holder.child.stdin.end('rollback;\n');assert.equal((await holder.finished).code,0);
 console.log('PASS: revocation, deactivation, chat and task mutations share transaction serialization (4 checks).');
} finally {clearTimeout(deadline);if(holder.child.exitCode===null)holder.child.stdin.end('rollback;\n');}
