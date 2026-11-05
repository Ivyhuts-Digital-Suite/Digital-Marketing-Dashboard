import {
  Activity,
  Bot,
  BookUser,
  Building,
  Building2,
  CalendarClock,
  ChartColumn,
  FileChartColumn,
  Gauge,
  Handshake,
  Images,
  LayoutDashboard,
  Megaphone,
  Plug,
  Route,
  Search,
  Settings,
  Share2,
  Sparkles,
  SquareKanban,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, type Permission } from '@mp/shared';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** `available` modules are functional now; `planned` modules render an honest placeholder. */
  status: 'available' | 'planned';
  /** Milestone in which a planned module is scheduled. */
  milestone?: string;
  /** Planned capabilities, shown on the placeholder page. */
  capabilities?: string[];
  /** Hide the entry from members who lack this permission. */
  permission?: Permission;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        status: 'available',
        description: 'Workspace overview, setup progress and recent activity.',
      },
      {
        title: 'Marketing Analytics',
        href: '/marketing-analytics',
        icon: ChartColumn,
        status: 'planned',
        milestone: 'Analytics',
        permission: PERMISSIONS.CAMPAIGNS_READ,
        description: 'Cross-channel performance across Google Ads and Meta Ads.',
        capabilities: ['Spend, conversions, CPA and ROAS by channel', 'Trend and period comparison', 'Account and campaign drill-down'],
      },
      {
        title: 'AI Insights',
        href: '/ai-insights',
        icon: Sparkles,
        status: 'planned',
        milestone: 'AI Intelligence',
        permission: PERMISSIONS.AI_RECOMMENDATIONS_READ,
        description: 'Automatically surfaced anomalies, opportunities and risks.',
        capabilities: ['Anomaly detection on spend and conversions', 'Prioritized opportunities', 'Explanations grounded in your data'],
      },
    ],
  },
  {
    title: 'Campaigns',
    items: [
      {
        title: 'All Campaigns',
        href: '/campaigns',
        icon: Megaphone,
        status: 'planned',
        milestone: 'Campaign Management',
        permission: PERMISSIONS.CAMPAIGNS_READ,
        description: 'Every synced campaign across connected ad accounts.',
        capabilities: ['Unified campaign list', 'Status, budget and performance at a glance', 'Pause and resume (permission-controlled)'],
      },
      {
        title: 'Google Ads',
        href: '/campaigns/google-ads',
        icon: Search,
        status: 'planned',
        milestone: 'Integrations',
        permission: PERMISSIONS.CAMPAIGNS_READ,
        description: 'Campaigns from connected Google Ads accounts.',
        capabilities: ['Search, Display, YouTube and Performance Max', 'Manager (MCC) account support', 'Scheduled sync'],
      },
      {
        title: 'Meta Ads',
        href: '/campaigns/meta-ads',
        icon: Share2,
        status: 'planned',
        milestone: 'Integrations',
        permission: PERMISSIONS.CAMPAIGNS_READ,
        description: 'Facebook and Instagram campaigns from connected Meta ad accounts.',
        capabilities: ['Campaigns, ad sets and ads', 'Placement breakdowns', 'Scheduled sync'],
      },
      {
        title: 'Creatives',
        href: '/campaigns/creatives',
        icon: Images,
        status: 'planned',
        milestone: 'Campaign Management',
        permission: PERMISSIONS.CAMPAIGNS_READ,
        description: 'Ad creatives and their performance.',
        capabilities: ['Creative library across platforms', 'Performance by creative', 'Fatigue indicators'],
      },
      {
        title: 'Budget Management',
        href: '/campaigns/budget',
        icon: Wallet,
        status: 'planned',
        milestone: 'Campaign Management',
        permission: PERMISSIONS.CAMPAIGNS_READ,
        description: 'Budgets, pacing and audited budget changes.',
        capabilities: ['Pacing against monthly targets', 'Budget changes with approval and audit trail', 'Overspend alerts'],
      },
    ],
  },
  {
    title: 'CRM',
    items: [
      {
        title: 'Leads',
        href: '/crm/leads',
        icon: UserPlus,
        status: 'planned',
        milestone: 'CRM',
        permission: PERMISSIONS.LEADS_READ,
        description: 'Inbound leads from ad platforms and forms.',
        capabilities: ['Lead capture from Meta and Google lead forms', 'Assignment and qualification', 'Source attribution'],
      },
      {
        title: 'Pipeline',
        href: '/crm/pipeline',
        icon: SquareKanban,
        status: 'planned',
        milestone: 'CRM',
        permission: PERMISSIONS.CRM_READ,
        description: 'Visual sales pipeline by stage.',
        capabilities: ['Drag-and-drop stages', 'Weighted forecast', 'Stage conversion rates'],
      },
      {
        title: 'Contacts',
        href: '/crm/contacts',
        icon: BookUser,
        status: 'planned',
        milestone: 'CRM',
        permission: PERMISSIONS.CRM_READ,
        description: 'People you do business with.',
        capabilities: ['Contact profiles and history', 'Deduplication', 'Custom fields'],
      },
      {
        title: 'Companies',
        href: '/crm/companies',
        icon: Building2,
        status: 'planned',
        milestone: 'CRM',
        permission: PERMISSIONS.CRM_READ,
        description: 'Accounts and organizations in your CRM.',
        capabilities: ['Company records', 'Related contacts and deals', 'Account ownership'],
      },
      {
        title: 'Deals',
        href: '/crm/deals',
        icon: Handshake,
        status: 'planned',
        milestone: 'CRM',
        permission: PERMISSIONS.CRM_READ,
        description: 'Opportunities, values and close dates.',
        capabilities: ['Deal tracking', 'Revenue attribution to campaigns', 'Win/loss analysis'],
      },
      {
        title: 'Activities',
        href: '/crm/activities',
        icon: Activity,
        status: 'planned',
        milestone: 'CRM',
        permission: PERMISSIONS.CRM_READ,
        description: 'Calls, emails, meetings and tasks.',
        capabilities: ['Activity timeline', 'Tasks and reminders', 'Rep activity reporting'],
      },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      {
        title: 'AI Analyst',
        href: '/intelligence/ai-analyst',
        icon: Bot,
        status: 'planned',
        milestone: 'AI Intelligence',
        permission: PERMISSIONS.AI_ANALYZE,
        description: 'Ask questions about your marketing and sales data.',
        capabilities: ['Natural-language analysis', 'Answers with cited data', 'Saved analyses'],
      },
      {
        title: 'Optimization',
        href: '/intelligence/optimization',
        icon: Gauge,
        status: 'planned',
        milestone: 'AI Intelligence',
        permission: PERMISSIONS.AI_RECOMMENDATIONS_READ,
        description: 'Recommendations for budgets, bids and targeting.',
        capabilities: ['Prioritized recommendations', 'Human approval before execution', 'Every executed change audited'],
      },
      {
        title: 'Audience Intelligence',
        href: '/intelligence/audience',
        icon: UsersRound,
        status: 'planned',
        milestone: 'AI Intelligence',
        permission: PERMISSIONS.AI_ANALYZE,
        description: 'Which audiences convert, and why.',
        capabilities: ['Segment performance', 'Lookalike suggestions', 'Audience overlap'],
      },
      {
        title: 'Creative Intelligence',
        href: '/intelligence/creative',
        icon: WandSparkles,
        status: 'planned',
        milestone: 'AI Intelligence',
        permission: PERMISSIONS.AI_ANALYZE,
        description: 'What makes creatives perform.',
        capabilities: ['Creative element analysis', 'Fatigue prediction', 'Variant suggestions'],
      },
      {
        title: 'Attribution',
        href: '/intelligence/attribution',
        icon: Route,
        status: 'planned',
        milestone: 'Analytics',
        permission: PERMISSIONS.CAMPAIGNS_READ,
        description: 'Connect ad spend to pipeline and revenue.',
        capabilities: ['Multi-touch attribution models', 'Campaign-to-deal revenue', 'Channel contribution'],
      },
    ],
  },
  {
    title: 'Reports',
    items: [
      {
        title: 'Reports',
        href: '/reports',
        icon: FileChartColumn,
        status: 'planned',
        milestone: 'Reporting',
        permission: PERMISSIONS.REPORTS_READ,
        description: 'Build and share performance reports.',
        capabilities: ['Report builder', 'Client-ready exports', 'Shareable links'],
      },
      {
        title: 'Scheduled Reports',
        href: '/reports/scheduled',
        icon: CalendarClock,
        status: 'planned',
        milestone: 'Reporting',
        permission: PERMISSIONS.REPORTS_READ,
        description: 'Reports delivered on a schedule.',
        capabilities: ['Daily, weekly and monthly schedules', 'Email delivery', 'Per-recipient permissions'],
      },
    ],
  },
  {
    title: 'Workspace',
    items: [
      {
        title: 'Organizations',
        href: '/workspace/organizations',
        icon: Building,
        status: 'available',
        description: 'Organizations you belong to.',
      },
      {
        title: 'Team Members',
        href: '/workspace/team',
        icon: Users,
        status: 'available',
        permission: PERMISSIONS.MEMBERS_READ,
        description: 'Members, roles and invitations.',
      },
      {
        title: 'Integrations',
        href: '/workspace/integrations',
        icon: Plug,
        status: 'available',
        permission: PERMISSIONS.INTEGRATIONS_READ,
        description: 'Advertising platform connections.',
      },
      {
        title: 'Settings',
        href: '/workspace/settings',
        icon: Settings,
        status: 'available',
        description: 'Organization, profile, security and audit log.',
      },
    ],
  },
];

const ALL_ITEMS = NAVIGATION.flatMap((section) => section.items.map((item) => ({ section: section.title, item })));

export function findNavItem(href: string): { section: string; item: NavItem } | undefined {
  return ALL_ITEMS.find(({ item }) => item.href === href);
}

/** Longest nav entry matching the pathname (so /campaigns/google-ads beats /campaigns). */
export function matchNavItem(pathname: string): { section: string; item: NavItem } | undefined {
  return ALL_ITEMS.filter(({ item }) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort(
    (a, b) => b.item.href.length - a.item.href.length,
  )[0];
}
