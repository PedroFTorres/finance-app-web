/* global module */
(function(root) {
  async function context(client,id) {
    const {data,error} = await client.rpc('arolix_contexto_baixa_parcial',{p_movimento_id:id});
    if (error) throw error;
    return data;
  }
  async function change(client,{tipo,item,action,patch={}}) {
    const {data,error} = await client.rpc('arolix_corrigir_baixa',{
      p_tipo:tipo,p_id:item.id,p_parcial:item.baixa_parcial === true,p_acao:action,p_patch:patch
    });
    if (error) throw error;
    return data;
  }
  const api = {context,change};
  root.ArolixPaymentActions=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
