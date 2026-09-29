select
  b.title,
  u.email,
  p.role,
  bm.is_board_admin
from public.board_memberships bm
join public.boards b on b.id = bm.board_id
join auth.users u on u.id = bm.user_id
join public.profiles p on p.id = bm.user_id
where u.email = 'teste2@exemplo.com';