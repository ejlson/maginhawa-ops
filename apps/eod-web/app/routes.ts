import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export default [
  route('sign-in', 'routes/sign-in.tsx'),
  layout('routes/signed-in.tsx', [
    index('routes/home.tsx'),
    route('close', 'routes/close.tsx'),
    route('close/review', 'routes/review.tsx'),
    route('close/done', 'routes/done.tsx'),
    route('close/:section', 'routes/section.tsx'),
    route('close/:session/cash', 'routes/cash.tsx'),
    route('checklists', 'routes/checklists.tsx'),
    route('checklists/edit', 'routes/checklist-lists.tsx'),
    route('checklists/edit/:id', 'routes/checklist-builder.tsx'),
    route('checklists/edit/:id/check/:check', 'routes/checklist-check.tsx'),
    route('checklists/:key', 'routes/checklist-run.tsx'),
    route('checklists/:key/fix/:checkpoint', 'routes/checklist-fix.tsx'),
    route('head-office', 'routes/head-office.tsx'),
    route('report', 'routes/report.tsx'),
    route('repairs', 'routes/repairs.tsx'),
    route('handover', 'routes/handover.tsx'),
    route('switch', 'routes/switch.tsx'),
    route('account', 'routes/account.tsx'),
    route('head-office/:site', 'routes/head-office-site.tsx'),
  ]),
] satisfies RouteConfig;
