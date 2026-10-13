alter table public.email_delivery_queue
  drop constraint if exists email_delivery_queue_category_check;

alter table public.email_delivery_queue
  add constraint email_delivery_queue_category_check
  check (category in (
    'nightwatch_signal','nightwatch_fill','nightwatch_risk','nightwatch_research',
    'nightwatch_summary','security','futures_access_request','futures_access_submitted',
    'futures_access_decision','futures_paper_trade'
  ));
