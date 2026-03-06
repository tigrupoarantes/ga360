// Cockpit GA — Type Definitions (migrado para GA360)

// ============= Datalake API Types =============

export interface DatalakeCompany {
  code: string;
  name: string;
  businessType: 'distributor' | 'retail' | 'hybrid';
  segmentMode: 'bu' | 'industry' | 'store' | 'category';
  industries?: DatalakeIndustry[];
  stores?: DatalakeStore[];
  businessUnits?: DatalakeBusinessUnit[];
}

export interface DatalakeIndustry {
  code: string;
  name: string;
}

export interface DatalakeStore {
  code: string;
  name: string;
  type: 'store' | 'dc';
}

export interface DatalakeBusinessUnit {
  code: string;
  name: string;
  industryCode: string;
}

// ============= Global Filters =============
// Nota: companyId removido — usar useCompany().selectedCompany.id diretamente

export interface CockpitFilters {
  period: 'today' | 'week' | 'month' | 'custom';
  customStartDate?: Date;
  customEndDate?: Date;
  channelCode: 'KA' | 'AS' | 'TRAD' | 'ALL';
  segmentType: 'bu' | 'industry';
  segmentId?: string;
  uf?: string;
}

// ============= KPI & Analytics Types =============

export interface KPISummary {
  salesDTD: number;
  salesWTD: number;
  salesMTD: number;
  salesVariation: number;
  positivationCount: number;
  positivationTotal: number;
  positivationPercent: number;
  positivationVariation: number;
  coverageCount: number;
  coverageTotal: number;
  coveragePercent: number;
  coverageIsProxy: boolean;
  ordersCount: number;
  ordersVariation: number;
  ticketAvg: number;
  ticketVariation: number;
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  description: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

export interface CityHeatmapPoint {
  cityId: string;
  cityName: string;
  uf: string;
  lat: number;
  lng: number;
  positivationPercent: number;
  coveragePercent: number;
  salesTotal: number;
  baseClients: number;
  positivatedClients: number;
}

export interface CityDetail {
  cityId: string;
  cityName: string;
  uf: string;
  kpis: {
    positivationPercent: number;
    coveragePercent: number;
    salesTotal: number;
    baseClients: number;
    positivatedClients: number;
    ordersCount: number;
    ticketAvg: number;
  };
  nonPositivatedClients: ClientAttack[];
}

export interface ClientAttack {
  clientId: string;
  clientCode: string;
  clientName: string;
  channelCode: string;
  sellerName: string;
  potentialScore: number;
  lastPurchaseDate?: string;
  daysSinceLastPurchase?: number;
}

export interface RankingItem {
  id: string;
  name: string;
  value: number;
  variation: number;
  rank: number;
}

// ============= DAB Response Types =============

export interface DabResponse<T = Record<string, unknown>> {
  value: T[];
  nextLink?: string;
}

// ============= DAB Logistics Types =============

export interface DabVendaProd {
  cod_empresa: string;
  cod_produto: string;
  desc_produto: string;
  cod_cidade?: string;
  desc_cidade?: string;
  uf?: string;
  cod_canal?: string;
  qtd_vendida: number;
  vlr_liquido: number;
  dt_venda?: string;
}

export interface DabVendaProdRaw {
  ID_VENDA: number;
  EMPRESA: string;
  COD_EMPRESA: number;
  DATA_VENDA: string;
  CIDADE_CLIENTE?: string;
  UF_CLIENTE?: string;
  SKU_PRODUTO: number;
  DESCRICAO_PRODUTO: string;
  QTDE_VENDIDA: number;
  VL_UNIT_VENDA: number;
}

export interface ABCItem {
  sku: string;
  name: string;
  revenue: number;
  quantity: number;
  percentOfTotal: number;
  cumulativePercent: number;
  classification: 'A' | 'B' | 'C';
}

export interface MixItem {
  sku: string;
  name: string;
  revenue: number;
  quantity: number;
  citiesCount: number;
  region: string;
}

export interface DabStockPosition {
  cod_empresa: string;
  cod_produto: string;
  desc_produto: string;
  cod_local: string;
  desc_local: string;
  qtd_estoque: number;
  vlr_estoque: number;
  dt_ultima_movimentacao?: string;
}

export interface DabStockPositionRaw {
  tenant_id: number;
  id_sku: number;
  nm_sku: string;
  qt_estoque: number;
}

export interface DabStockLot {
  cod_empresa: string;
  cod_produto: string;
  desc_produto: string;
  lote: string;
  dt_validade: string;
  qtd_estoque: number;
  cod_local: string;
  desc_local: string;
}

// ============= Configuration Types =============
// Mapeado sobre dl_connections do GA360

export interface DlConnection {
  id: string;
  companyId?: string;
  name: string;
  baseUrl: string;
  authType: 'bearer' | 'api_key' | 'basic';
  authConfigJson: Record<string, string>;
  headersJson: Record<string, string>;
  isEnabled: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'error' | 'running' | 'pending';
  createdAt: string;
  updatedAt: string;
}
