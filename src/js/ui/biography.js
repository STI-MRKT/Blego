import {state} from '../state.js';
import {esc} from '../utils/dom.js';
import {I} from '../icons.js';
const labels={residence:'Место проживания',birthplace:'Место рождения',employer:'Место работы',position:'Должность',university:'Университет',school:'Средняя школа',mainBio:'BIO основной страницы'};
export function biographyStatus(editor){
 return editor.error?'Не удалось сохранить BIO. Введённые данные остаются здесь.':editor.saving?'Сохраняем…':editor.dirty?'':'Сохранено';
}
export function biographyHTML(){
 const editor=state.bioEditor;
 const locked=editor?.frozen?'disabled':'';
 if(!editor||editor.profileId!==state.demo?.id)return '<section class="card pad"><p>Загрузка BIO…</p></section>';
 return `<section class="card pad biography"><div class="head-actions"><h2>BIO</h2><span role="status">${biographyStatus(editor)}</span><button class="btn btn-quiet" data-action="bio-retry" ${editor.error?'':'hidden style="display:none"'}>Повторить сохранение</button></div><p class="muted">Синтетический пример${state.demo.namingStrategy==='brand_name'?' проекта':': работа и образование не подтверждают биографию реального человека'}.</p><div class="fields">${Object.entries(labels).map(([key,label])=>{
 const institutions=editor.institutions.filter(i=>i.kind===key);
 return `<div class="bio-field"><label class="fl" for="bio-${key}">${label}</label><div class="head-actions">${key==='mainBio'?`<textarea ${locked} class="input" rows="4" id="bio-${key}" data-bio-field="${key}" maxlength="4000">${esc(editor.values[key])}</textarea>`:`<input ${locked} class="input" id="bio-${key}" data-bio-field="${key}" maxlength="500" value="${esc(editor.values[key])}">`}<button class="copy" data-action="bio-copy" data-field="${key}" aria-label="Копировать ${label}">${I.copy}</button><button class="copy" data-action="bio-regenerate" data-field="${key}" title="Подобрать заново: ${label}" aria-label="Подобрать заново: ${label}" ${editor.suggesting||editor.frozen?'disabled':''}>${I.refresh}</button></div>${['university','school'].includes(key)?`<select ${locked} class="input" data-bio-institution="${key}" aria-label="Выбрать: ${label}"><option value="">${institutions.length?'Выберите учебное заведение':'Нет данных — можно ввести вручную'}</option>${institutions.map(i=>`<option value="${esc(i.name+' — '+i.city)}">${esc(i.name)} — ${esc(i.city)}</option>`).join('')}</select>`:''}</div>`;
 }).join('')}</div></section>`;
}
