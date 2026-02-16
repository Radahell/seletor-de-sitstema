/**
 * Integração com API do IBGE (gratuita, sem autenticação)
 * - Lista de estados brasileiros (hardcoded, não muda)
 * - Busca de cidades por UF via API
 * - Mapeamento UF → timezone
 */

export interface Estado {
  sigla: string;
  nome: string;
}

export interface Cidade {
  id: number;
  nome: string;
}

// 27 estados - hardcoded (não mudam)
export const ESTADOS: Estado[] = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
];

// Mapeamento UF → timezone IANA
// Brasil tem 4 fusos: UTC-2 (Noronha), UTC-3 (Brasília), UTC-4 (Manaus), UTC-5 (Acre)
const UF_TIMEZONE: Record<string, string> = {
  AC: 'America/Rio_Branco',
  AL: 'America/Maceio',
  AP: 'America/Belem',
  AM: 'America/Manaus',
  BA: 'America/Bahia',
  CE: 'America/Fortaleza',
  DF: 'America/Sao_Paulo',
  ES: 'America/Sao_Paulo',
  GO: 'America/Sao_Paulo',
  MA: 'America/Fortaleza',
  MT: 'America/Cuiaba',
  MS: 'America/Campo_Grande',
  MG: 'America/Sao_Paulo',
  PA: 'America/Belem',
  PB: 'America/Fortaleza',
  PR: 'America/Sao_Paulo',
  PE: 'America/Recife',
  PI: 'America/Fortaleza',
  RJ: 'America/Sao_Paulo',
  RN: 'America/Fortaleza',
  RS: 'America/Sao_Paulo',
  RO: 'America/Porto_Velho',
  RR: 'America/Boa_Vista',
  SC: 'America/Sao_Paulo',
  SP: 'America/Sao_Paulo',
  SE: 'America/Maceio',
  TO: 'America/Araguaina',
};

export function getTimezoneByUF(uf: string): string {
  return UF_TIMEZONE[uf.toUpperCase()] || 'America/Sao_Paulo';
}

// Cache de cidades por UF (evita re-fetch)
const cidadesCache: Record<string, Cidade[]> = {};

export async function fetchCidadesByUF(uf: string): Promise<Cidade[]> {
  const key = uf.toUpperCase();
  if (cidadesCache[key]) return cidadesCache[key];

  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${key}/municipios?orderBy=nome`
  );

  if (!res.ok) return [];

  const data: Array<{ id: number; nome: string }> = await res.json();
  const cidades = data.map((c) => ({ id: c.id, nome: c.nome }));
  cidadesCache[key] = cidades;
  return cidades;
}
