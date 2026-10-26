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
    route('head-office', 'routes/head-office.tsx'),
  ]),
] satisfies RouteConfig;
