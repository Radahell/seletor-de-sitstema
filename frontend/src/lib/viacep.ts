/**
 * Integração com API ViaCEP (gratuita, sem autenticação)
 * Auto-preenchimento de endereço a partir do CEP.
 */

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string; // cidade
  uf: string;         // estado (sigla)
}

const cache: Record<string, ViaCepResponse | null> = {};

/**
 * Busca endereço pelo CEP via API ViaCEP.
 * Retorna null se o CEP for inválido ou não encontrado.
 */
export async function fetchAddressByCep(cep: string): Promise<ViaCepResponse | null> {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;

  if (clean in cache) return cache[clean];

  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.erro) {
      cache[clean] = null;
      return null;
    }

    const result: ViaCepResponse = {
      cep: data.cep,
      logradouro: data.logradouro || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      localidade: data.localidade || '',
      uf: data.uf || '',
    };

    cache[clean] = result;
    return result;
  } catch {
    return null;
  }
}
