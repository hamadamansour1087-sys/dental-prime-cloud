export type Preset = "today" | "week" | "month" | "last_month" | "ytd" | "custom";

export interface DateRange {
  from: string;
  to: string;
}

export interface ReportsFilters {
  range: DateRange;
  doctorFilter: string;
  workTypeFilter: string;
  categoryFilter: string;
  governorateFilter: string;
}

export interface DoctorRef {
  id: string;
  name: string;
  governorate: string | null;
}

export interface WorkTypeRef {
  id: string;
  name: string;
  category_id: string | null;
}

export interface CategoryRef {
  id: string;
  name: string;
  color: string | null;
}

export interface DeliveredCaseRow {
  id: string;
  case_number: string | null;
  date_delivered: string | null;
  date_received: string | null;
  price: number | null;
  units: number | null;
  doctor_id: string | null;
  work_type_id: string | null;
  status: string | null;
}

export interface ReceivedCaseRow {
  id: string;
  date_received: string | null;
  doctor_id: string | null;
  work_type_id: string | null;
  units: number | null;
  status: string | null;
}

export interface PaymentRow {
  id: string;
  doctor_id: string;
  amount: number;
  payment_date: string;
  method: string | null;
}

export interface DoctorBalance extends DoctorRef {
  billed: number;
  paid: number;
  balance: number;
}

export interface WorkTypeAgg { name: string; count: number; units: number; revenue: number }
export interface CategoryAgg extends WorkTypeAgg { color: string }
export interface DoctorAgg extends WorkTypeAgg { paid: number }
export interface GovernorateAgg extends WorkTypeAgg { doctors: number }
export interface DailyTrendRow { date: string; revenue: number; cases: number; payments: number }
