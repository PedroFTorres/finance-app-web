```js
descLanc.value=''
dataLanc.value=''
await refreshMovements()
})


async function refreshMovements(){
const conta_id = selectContas.value
if(!conta_id) return


const [receitasRes, despesasRes] = await Promise.all([
supabase.from('receitas').select('*').eq('conta_id', conta_id).order('data', { ascending: false }),
supabase.from('despesas').select('*').eq('conta_id', conta_id).order('data', { ascending: false })
])
if(receitasRes.error||despesasRes.error) return console.error(receitasRes.error||despesasRes.error)


listReceitas.innerHTML = ''
listDespesas.innerHTML = ''


let totalReceitas = 0
let totalDespesas = 0


(receitasRes.data||[]).forEach(r=>{
totalReceitas += Number(r.valor)
const li = document.createElement('li')
li.textContent = `${r.data} — ${r.descricao} — R$ ${Number(r.valor).toFixed(2)}`
listReceitas.appendChild(li)
})


(despesasRes.data||[]).forEach(d=>{
totalDespesas += Number(d.valor)
const li = document.createElement('li')
li.textContent = `${d.data} — ${d.descricao} — R$ ${Number(d.valor).toFixed(2)}`
listDespesas.appendChild(li)
})


totalReceitasEl.textContent = `R$ ${totalReceitas.toFixed(2)}`
totalDespesasEl.textContent = `R$ ${totalDespesas.toFixed(2)}`


const saldoInicial = parseFloat(selectContas.selectedOptions[0]?.text.match(/\(R\$\s*([0-9.,]+)\)/)?.[1]?.replace(',', '.') || 0)
const saldoAtual = (saldoInicial + totalReceitas) - totalDespesas
saldoAtualEl.textContent = `R$ ${Number(saldoAtual).toFixed(2)}`
}


function subscribeToChanges(){
// real-time updates for receitas and despesas
supabase.channel('public:receitas')
.on('postgres_changes', { event: '*', schema: 'public', table: 'receitas' }, payload => refreshMovements())
.subscribe()


supabase.channel('public:despesas')
.on('postgres_changes', { event: '*', schema: 'public', table: 'despesas' }, payload => refreshMovements())
}
```


---
