import {state} from '../state.js';
import {esc} from '../utils/dom.js';
import {LOCALES} from '../data/locales.js';
import {I} from '../icons.js';
const labels={residence:'Место проживания',birthplace:'Место рождения',employer:'Место работы',employerCity:'Город организации',position:'Должность',university:'Университет',universityCity:'Город университета',school:'Средняя школа',schoolCity:'Город школы',mainBio:'BIO основной страницы'};
export function biographyStatus(editor){
 return editor.error?'Не удалось сохранить BIO. Введённые данные остаются здесь.':editor.saving?'Сохраняем…':editor.dirty?'':'Сохранено';
}
export function biographyHTML(){
 const editor=state.bioEditor;
 const locked=editor?.frozen?'disabled':'';
 const controls=biographyControls();
 if(!editor)return controls+'<section class="card empty"><h3>BIO пока не создано</h3><p>Выберите страну, город и тематику.</p></section>';
 return controls+`<section class="card pad biography"><div class="head-actions"><h2>BIO</h2><span role="status">${biographyStatus(editor)}</span><button class="btn btn-quiet" data-action="bio-retry" ${editor.error?'':'hidden style="display:none"'}>Повторить сохранение</button></div><div class="fields">${Object.entries(labels).map(([key,label])=>{

 return `<div class="bio-field field"><label class="field-label" for="bio-${key}">${label}</label><div class="head-actions">${key==='mainBio'?`<textarea ${locked} class="input bio-value" rows="2" id="bio-${key}" data-bio-field="${key}" maxlength="4000">${esc(editor.values[key] || '')}</textarea>`:`<input ${locked} class="input bio-value" id="bio-${key}" data-bio-field="${key}" maxlength="500" value="${esc(editor.values[key] || '')}">`}<button class="copy" data-action="bio-copy" data-field="${key}" aria-label="Копировать ${label}">${I.copy}</button>${!key.endsWith('City') ? `<button class="copy" data-action="bio-regenerate" data-field="${key}" title="Подобрать заново: ${label}" aria-label="Подобрать заново: ${label}" ${editor.suggesting||editor.frozen?'disabled':''}>${I.refresh}</button>` : ''}</div></div>`;
 }).join('')}</div></section>`;
}

function biographyControls(){
 const p=state.bioParamsEditor?.values||state.bio?.parameters||{country:'BR',city:'',type:'model'};
 const locked=state.bioBusy||!state.bio?'disabled':'';
 return `<div class="card controls ux-primary-controls">
 <div class="ctl ctl-sm"><label class="fl" for="bio-country">Страна</label><select class="input" id="bio-country" data-bio-param="country" ${locked}>${Object.entries(LOCALES).map(([key,l])=>`<option value="${key}" ${p.country===key?'selected':''}>${esc(l.name.en)} · ${esc(l.dial)}</option>`).join('')}</select></div>
 <div class="ctl ctl-sm"><label class="fl" for="bio-city">Город</label><input class="input" id="bio-city" data-bio-param="city" value="${esc(p.city)}" maxlength="120" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" autocomplete="off" ${locked}><datalist id="bio-cities" hidden>${(state.bioCities||[]).map(row=>`<option value="${esc(row.city)}">${esc(row.postalCode)}</option>`).join('')}</datalist></div>
 <div class="ctl ctl-sm"><label class="fl" for="bio-type">Тематика</label><select class="input" id="bio-type" data-bio-param="type" ${locked}>${['model','tech','crypto'].map(type=>`<option value="${type}" ${p.type===type?'selected':''}>${type}</option>`).join('')}</select></div>
 <div class="ctl-actions"><button class="btn btn-quiet" data-action="bio-clear" ${locked||(!editorPresent()?'disabled':'')}>Очистить BIO</button><button class="btn btn-primary" data-action="bio-generate" ${locked}>${I.spark}<span class="lbl">${state.bioBusy?'Создаём…':'Сгенерировать BIO'}</span></button></div></div>
 <div role="status" data-bio-params-status>${state.bioParamsEditor?.error?'Не удалось сохранить параметры BIO.':''}</div>
 <button class="btn btn-quiet" data-action="bio-params-retry" ${state.bioParamsEditor?.error?'':'hidden style="display:none"'}>Повторить сохранение параметров</button>
 ${!state.bio?'<button class="btn" data-action="bio-load">Повторить открытие BIO</button>':''}`;
}
function editorPresent(){return Boolean(state.bioEditor);}
