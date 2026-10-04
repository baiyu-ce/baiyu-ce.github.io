'use strict';
const methods=[
 ['01 / TRACE','先还原每一步发生了什么','将任务、智能体消息、工具调用和返回信息整理成有序步骤。保留步骤编号，使每一条后续引用都能回到原位置。','工具返回“amount_minor: 129900，unit: 分”。这条记录必须与智能体随后输出的“129900 元”分开保存。','输入里的答案标签应剔除，避免把参考答案提前泄漏给诊断过程。'],
 ['02 / CONSTRAINTS','把模糊要求写成可检查的问题','围绕任务要求与工具语义提出检查标准，明确一个步骤需要满足什么条件，而不是只让模型自由评论整段轨迹。','金额输出必须采用用户要求的单位；如果工具返回的是“分”，输出“元”前应进行换算。','约束也可能不准确，需要检查它是否适用于当前任务。'],
 ['03 / VERIFICATION','区分通过、违反与不确定','结合该步可见的轨迹前缀，检查约束是否得到满足，并要求提供指向原记录的证据。','CLEAR_PASS：单位正确；CLEAR_FAIL：记录明确显示单位错误；UNCLEAR：记录不足以判断单位。','不能用未来步骤的信息为当前步骤补充它当时不知道的事实。'],
 ['04 / REFLECTION','检查证据质量，再筛选信息','反思检查结果是否受到错误约束、证据缺失或解释歧义影响。筛选能减少噪声，也可能移除后续诊断有用的弱证据。','本项目正在探索：额外保留 UNCLEAR 检查信息，是否会改变后续诊断？','反思与筛选是已有基线的一部分，本项目没有将其宣称为新方法。'],
 ['05 / DIAGNOSIS','把关键步骤、原因与引用连起来','综合轨迹与检查信息，给出关键失败步骤、失败类别、解释和引用。人可以按步骤回看证据，复核结论。','如果第一步的超时已恢复，而第三步的单位错误一直未纠正，应重点检查第三步，而不是只看超时或最终答案。','“引用文字存在”只说明引用能匹配，不证明解释一定正确。']
];
document.querySelectorAll('[data-method]').forEach(button=>button.addEventListener('click',()=>{
 const item=methods[Number(button.dataset.method)];
 document.querySelectorAll('[data-method]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 ['method-label','method-title','method-body','method-example','method-limit'].forEach((id,i)=>document.getElementById(id).textContent=item[i]);
}));
const cases=[
 {title:'重试之后，还算关键失败吗？',key:null,steps:[
  ['工具请求超时','检索工具','检索请求：价格列表\n工具返回：timeout','先保留这个现象，再检查后续是否恢复。'],
  ['重试成功','检索工具','重试返回：商品 A，价格 1299 元\n状态：success','错误可以被恢复。一次超时不自动等于最终失败的根因。'],
  ['校验价格来源','审阅智能体','核对返回值：1299 元\n来源与单位一致','这里有明确的校验记录，而不是仅凭没有报错判断成功。'],
  ['输出正确价格','回答智能体','最终回答：商品 A 的价格为 1299 元。','这条虚构轨迹中，最初的超时没有导致最终答案失败。']
 ],heading:'已恢复的异常，不应直接归为关键失败。',explanation:'第 1 步确实报错，但第 2 步重新获得了所需数据，后续记录也与该数据一致。在这个预设案例中，没有证据支持把首次超时认定为最终失败的根因。'},
 {title:'数据没错，为什么答案错了？',key:2,steps:[
  ['工具请求超时','检索工具','检索请求：商品 A 价格\n工具返回：timeout','这里出现了异常，但还需要继续检查是否恢复。'],
  ['重新取得金额数据','检索工具','amount_minor: 129900\ncurrency: CNY\nunit: 分','工具明确给出了单位。129900 分对应 1299 元。'],
  ['错误解释金额单位','分析智能体','根据工具返回，商品 A 的价格为 129900 元。','对照上一条记录：数值被直接使用，单位却被改变了。'],
  ['仅检查表达格式','审阅智能体','句式完整，包含商品名、数值与币种。\n格式检查通过。','格式检查通过不能证明金额换算正确。'],
  ['错误金额进入最终答案','回答智能体','最终回答：商品 A 的价格为 129900 元。','最终答案延续了第 3 步的解释错误。']
 ],heading:'重点检查第 3 步：单位解释首次偏离。',explanation:'第 1 步的超时已在第 2 步恢复。第 3 步首次把“分”解释成“元”，该错误直到最终答案仍未纠正。在这个完整预设案例中，它是应优先定位的关键失败；第 5 步则是后续症状。'},
 {title:'没有保存记录，等于没有保存吗？',key:null,steps:[
  ['请求保存报告','调度智能体','请求：将报告保存为 report.json\n工具返回记录：缺失','看不到返回记录，可能是操作失败，也可能是日志不完整。'],
  ['声称报告已保存','写作智能体','报告已经成功保存，可以进入汇总。','这个陈述在可见日志中缺少成功返回值支撑。'],
  ['读取文件失败','读取工具','读取 report.json\n返回：File not found','存在失败，但单凭这条记录仍不能排除目录不同或文件随后被删除。'],
  ['汇总中止','调度智能体','没有取得报告内容，本次汇总停止。','可以确认汇总中止；最初失败的具体原因仍需要额外证据。']
 ],heading:'证据支持疑点，但还不支持唯一根因。',explanation:'“缺少保存记录”不能直接证明从未保存。可以指出第 2 步的成功宣称缺乏可见支撑，但确定根因还需要保存返回值、实际路径与文件状态等信息。这个案例适合保留 UNCLEAR，而不是强行给出确定答案。'}
];
let activeCase=0,selectedStep=0,explained=false;
const byId=id=>document.getElementById(id);
function selectStep(index){selectedStep=index;const step=cases[activeCase].steps[index];byId('selected-label').textContent='SELECTED STEP / '+String(index+1).padStart(2,'0');byId('selected-title').textContent=step[0];byId('selected-log').textContent=step[2];byId('selected-hint').textContent=step[3];document.querySelectorAll('.trace-button').forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-pressed',String(i===index));});}
function renderCase(index){activeCase=index;selectedStep=0;explained=false;const item=cases[index];byId('case-title').textContent=item.title;byId('case-count').textContent=item.steps.length+' STEPS';byId('trace-steps').replaceChildren();document.querySelectorAll('[data-case]').forEach(b=>{const active=Number(b.dataset.case)===index;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});item.steps.forEach((step,i)=>{const li=document.createElement('li'),button=document.createElement('button'),number=document.createElement('span'),body=document.createElement('div'),title=document.createElement('strong'),role=document.createElement('small');button.type='button';button.className='trace-button';number.textContent=String(i+1).padStart(2,'0');title.textContent=step[0];role.textContent=step[1];body.append(title,role);button.append(number,body);button.addEventListener('click',()=>selectStep(i));li.append(button);byId('trace-steps').append(li);});byId('case-explanation').hidden=true;byId('case-explanation').replaceChildren();byId('explain-button').textContent='展开预设讲解 →';byId('explain-button').setAttribute('aria-expanded','false');selectStep(0);}
document.querySelectorAll('[data-case]').forEach(b=>b.addEventListener('click',()=>renderCase(Number(b.dataset.case))));
byId('explain-button').setAttribute('aria-controls','case-explanation');
byId('explain-button').addEventListener('click',()=>{explained=!explained;const item=cases[activeCase],panel=byId('case-explanation');panel.hidden=!explained;byId('explain-button').textContent=explained?'收起预设讲解 ↑':'展开预设讲解 →';byId('explain-button').setAttribute('aria-expanded',String(explained));if(explained){const h=document.createElement('h4'),p=document.createElement('p'),small=document.createElement('small');h.textContent=item.heading;p.textContent=item.explanation;small.textContent='人工编写的预设讲解 · 没有运行模型 · 不属于实验结果';panel.replaceChildren(h,p,small);}document.querySelectorAll('.trace-button').forEach((b,i)=>b.classList.toggle('key-step',explained&&item.key===i));});
renderCase(0);
