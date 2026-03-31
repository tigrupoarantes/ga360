/**
 * Pre-built starter templates that users can pick when creating a new template.
 * HTML uses the <span data-placeholder-key="key"> format for placeholders.
 */

function ph(key: string): string {
  return `<span data-placeholder-key="${key}">{{${key}}}</span>`;
}

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  html: string;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'recibo-verba',
    name: 'Recibo de Verba Indenizatoria',
    description:
      'Modelo padrao de recibo de quitacao de despesas relativas ao veiculo do funcionario.',
    html: `<h2 style="text-align: center">RECIBO DE QUITACAO DE DESPESAS RELATIVAS AO VEICULO DE MINHA PROPRIEDADE</h2>
<p>Eu, <strong>${ph('nome_funcionario')}</strong>, ${ph('cargo')} inscrito(a) no CPF sob o n. ${ph('cpf')} venho informar que o valor de <strong>${ph('valor_verba')}</strong> depositado em minha conta bancaria e lancados em minha folha de pagamento como VERBA INDENIZATORIA no dia ${ph('data_geracao')}, refere-se ao adiantamento da verba indenizatoria para visitar 100% dos clientes do roteiro estabelecido entre os dias 01 a 31 da competencia ${ph('competencia')}.</p>
<p>Declaro que o valor recebido se refere aos gastos com combustivel, manutencao, depreciacao, pedagio, contratacao de seguro pessoal, ajuda no custeio com o pagamento de taxas, impostos, licenciamentos etc. e e suficiente, nao tendo desta forma nada o que reclamar.</p>
<p style="text-align: center">${ph('data_geracao')}</p>
<p style="text-align: center">------------------------------------------------------------------------------</p>
<p style="text-align: center">Assinatura:</p>
<p style="text-align: center"><strong>${ph('nome_funcionario')}</strong></p>`,
  },
  {
    id: 'recibo-adiantamento',
    name: 'Recibo de Adiantamento',
    description:
      'Modelo para adiantamento de verba indenizatoria com valores de adiantamento.',
    html: `<h2 style="text-align: center">RECIBO DE ADIANTAMENTO DE VERBA INDENIZATORIA</h2>
<p>Eu, <strong>${ph('nome_funcionario')}</strong>, ${ph('cargo')} do departamento ${ph('departamento')}, unidade ${ph('unidade')}, inscrito(a) no CPF sob o n. ${ph('cpf')}, declaro ter recebido o valor de <strong>${ph('valor_adiantamento')}</strong> a titulo de adiantamento de verba indenizatoria referente a competencia ${ph('competencia')}.</p>
<p>Este valor destina-se a cobrir despesas com deslocamento para atendimento da carteira de clientes, incluindo combustivel, manutencao veicular, pedagios e demais custos operacionais.</p>
<p>Empresa: ${ph('empresa')}</p>
<p>Grupo: ${ph('grupo_contabilizacao')}</p>
<p style="text-align: center">${ph('data_geracao')}</p>
<p style="text-align: center">______________________________</p>
<p style="text-align: center"><strong>${ph('nome_funcionario')}</strong></p>
<p style="text-align: center">${ph('cpf')}</p>`,
  },
  {
    id: 'termo-simples',
    name: 'Termo Simples (em branco)',
    description: 'Modelo minimo para criar seu proprio documento do zero.',
    html: `<h2 style="text-align: center">TITULO DO DOCUMENTO</h2>
<p>Eu, <strong>${ph('nome_funcionario')}</strong>, inscrito(a) no CPF sob o n. ${ph('cpf')}, declaro que...</p>
<p style="text-align: center">${ph('data_geracao')}</p>
<p style="text-align: center">______________________________</p>
<p style="text-align: center"><strong>${ph('nome_funcionario')}</strong></p>`,
  },
];
