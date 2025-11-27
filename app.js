async function loadContas() {
  const { data, error } = await supabase
    .from('contas_bancarias')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error("Erro ao carregar contas:", error)
    return
  }

  selectContas.innerHTML = ""

  if (!data || data.length === 0) {
    const opt = document.createElement("option")
    opt.value = ""
    opt.textContent = "Nenhuma conta cadastrada"
    selectContas.appendChild(opt)
    return
  }

  data.forEach(c => {
    const opt = document.createElement('option')
    opt.value = c.id
    opt.textContent = `${c.nome} (R$ ${Number(c.saldo_inicial || 0).toFixed(2)})`
    selectContas.appendChild(opt)
  })

  // Selecionar automaticamente a primeira conta
  selectContas.value = data[0].id

  refreshMovements()
}

