(async()=>{
  DR.styles=await(await fetch('/ui.css')).text();
  let answers;
  try{const response=await fetch(DR.RELAY+'/v1/answers?limit=100',{credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error();answers=(await response.json()).answers;}catch{answers=(await(await fetch('/sample.json')).json()).answers;}
  // Keep the preview useful when no research has been published within retention.
  const transport=async()=>({answers,preferences:DR.DEFAULTS,lastSuccess:Date.now(),error:null});
  const app=new DR.ChatApp({transport});await app.tick();
  if(app.answers.length){app.insert(app.answers.at(-1));app.selected=app.answers.at(-1).id;}
  const lines=document.querySelector('.chat-lines');
  for(const [name,text] of [['northstar','nice, that answers it'],['readthefootnote','the stream link goes right to the question'],['coffeeandcontext','i missed the previous answer, checking history']]){
    const node=document.createElement('div');node.className='msg-chat green';const user=document.createElement('a');user.className='user';user.textContent=name;node.append(user,document.createTextNode(': '+text));lines.append(node);
  }
  lines.scrollTop=0;
  setInterval(()=>app.tick(),15000);
})();
