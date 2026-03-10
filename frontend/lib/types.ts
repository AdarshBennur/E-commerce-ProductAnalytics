// Shared TypeScript types for the analytics dashboard

export interface KPIs {
    total_users_approx: number
    total_sessions: number
    total_purchases: number
    total_revenue: number
    conversion_rate: number
    avg_order_value: number
}

export interface TimeseriesPoint {
    date:      string
    dau?:      number
    sessions?: number
    views?:    number
    carts?:    number
    purchases?: number
    revenue?:  number
    orders?:   number
    aov?:      number
    [key: string]: unknown   // allows using TimeseriesPoint as AnyRow
}

export interface OverviewData {
    kpis: KPIs
    timeseries: TimeseriesPoint[]
}

export interface FunnelTotals {
    viewers: number
    carted: number
    purchasers: number
    view_to_cart_pct: number
    cart_to_purchase_pct: number
    overall_conversion_pct: number
}

export interface FunnelData {
    funnel: FunnelTotals
    timeseries: { date: string; viewers: number; carted: number; purchasers: number }[]
    top_categories: { category_main: string; viewers: number; purchasers: number; conversion_rate: number }[]
}

export interface CohortRow {
    cohort_week: string
    activity_week: string
    cohort_size: number
    retained_users: number
    retention_pct: number
    week_number: number
}

export interface RetentionData {
    cohort_matrix: CohortRow[]
    week_averages: { week_number: number; avg_retention_pct: number; total_retained: number }[]
}

export interface BehaviorData {
    session_stats: {
        avg_views_per_session: number
        avg_products_per_session: number
        avg_session_duration_min: number
        avg_events_per_session: number
        session_conversion_rate: number
        total_sessions: number
    }
    sessions_distribution: { sessions_bucket: string; user_count: number }[]
    hourly_patterns: { day_of_week: number; hour_of_day: number; views: number; purchases: number; revenue: number }[]
    user_segments: { segment: string; user_count: number; avg_spend: number; avg_sessions: number }[]
}

export interface CategoryData {
    top_categories: { category: string; views: number; purchases: number; revenue: number; conversion_rate: number }[]
    top_brands: { brand: string; views: number; purchases: number; revenue: number; conversion_rate: number; avg_price: number }[]
    category_conversion: { category: string; conversion_rate: number; views: number; purchases: number }[]
}

export interface RevenueData {
    kpis: { total_revenue: number; total_orders: number; avg_order_value: number; unique_buyers: number }
    timeseries: { date: string; revenue: number; orders: number; aov: number }[]
    by_category: { category: string; revenue: number; orders: number; aov: number }[]
}

export interface FiltersData {
    categories: string[]
    brands: string[]
    date_bounds: { min_date: string; max_date: string }
}

export interface Filters {
    startDate: string
    endDate: string
    category: string
    brand: string
    segment: string
}

export interface SegmentOption {
    id:    string
    label: string
    description: string
}

export interface InsightItem {
    type:        string
    message:     string
    severity:    string
    metric?:     string
    trend?:      string
    badge?:      string
    badge_type?: string
}

export interface RecommendationItem {
    id:          string
    title:       string
    explanation: string
    metric_ref:  string
    priority:    'critical' | 'high' | 'medium' | 'low'
    category:    string
    icon:        string
}
