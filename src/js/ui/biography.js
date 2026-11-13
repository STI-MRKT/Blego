import {state} from '../state.js';
import {esc} from '../utils/dom.js';
import {I} from '../icons.js';
const labels={residence:'Место проживания',birthplace:'Место рождения',employer:'Место работы',position:'Должность',university:'Университет',school:'Средняя школа',mainBio:'BIO основной страницы'};
export function biographyHTML(){
 const editor=state.bioEditor;
 if(!editor||editor.profileId!==state.demo?.id)return '<section class="card pad"><p>Загрузка BIO…</p></section>';
 return `<section class="card pad biography"><div class="head-actions"><h2>BIO</h2><button class="btn btn-primary" data-action="bio-save" ${editor.saving?'disabled':''}>${editor.saving?'Сохраняем…':'Сохранить BIO'}</button><span role="status">${editor.dirty?'Есть несохранённые изменения':'Сохранено'}</span></div><div class="fields">${Object.entries(labels).map(([key,label])=>{
 const institutions=editor.institutions.filter(i=>i.kind===key);
 return `<div class="bio-field"><label class="fl" for="bio-${key}">${label}</label><div class="head-actions">${key==='mainBio'?`<textarea class="input" rows="4" id="bio-${key}" data-bio-field="${key}" maxlength="4000">${esc(editor.values[key])}</textarea>`:`<input class="input" id="bio-${key}" data-bio-field="${key}" maxlength="500" value="${esc(editor.values[key])}">`}<button class="copy" data-action="bio-copy" data-field="${key}" aria-label="Копировать ${label}">${I.copy}</button></div>${['university','school'].includes(key)?`<select class="input" data-bio-institution="${key}" aria-label="Выбрать: ${label}"><option value="">${institutions.length?'Выберите учебное заведение':'Нет данных — можно ввести вручную'}</option>${institutions.map(i=>`<option value="${esc(i.name+' — '+i.city)}">${esc(i.name)} — ${esc(i.city)}</option>`).join('')}</select>`:''}${key==='position'?'<button class="btn btn-quiet" data-action="bio-work">Подобрать работу и должность</button>':''}${key==='mainBio'?'<button class="btn btn-quiet" data-action="bio-generate">Сгенерировать BIO</button>':''}</div>`;
 }).join('')}</div></section>`;
}
