import { supabase } from './supabase.js'

const authSection = document.getElementById('auth')
const appSection = document.getElementById('app')
const userArea = document.getElementById('user-area')

const emailInput = document.getElementById('email')
const passInput = document.getElementById('password')
const btnSignup = document.getElementById('btn-signup')
const btnSignin = document.getElementById('btn-signin')
const btnLogout = document.getElementById('btn-logout')

const selectContas = document.getElementById('select-contas')
const btnAddConta = document.getElementById('btn-add-conta')
const contaNome = document.getElementById('conta-nome')
const contaSaldo = document.getElementById('conta-saldo')

const tipoLanc = document.getElementById('tipo-lancamento')
const valorLanc = document.getElementById('valor-lanc')
const descLanc = document.getElementById('desc-lanc')
const dataLanc = document.getElementById('data-lanc')
const btnAddLanc = document.getElementById('btn-add-lanc')

const saldoAtualEl = document.getElementById('saldo-atual')
const totalReceitasEl = document.getElementById('total-receitas')
const totalDespesasEl = document.getElementById('total-despesas')
const listReceitas = document.getElementById('list-receitas')
const listDespesas = document.getElementById('list-despesas')

let currentUser = null
