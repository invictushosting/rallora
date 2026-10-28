"""Two real PostgreSQL connections race the same confirmation, using synthetic data only."""
import subprocess


def sql(query):
    return subprocess.run(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-Atc', query], capture_output=True, text=True)


setup = """
insert into auth.users(id,email) values
 ('91919191-0000-0000-0000-000000000001','race-one@example.invalid'),
 ('91919191-0000-0000-0000-000000000002','race-two@example.invalid');
insert into public.seasons(id,club_id,name,status) values
 ('91919191-0000-0000-0000-000000000010','00000000-0000-0000-0000-0000000000a1','Synthetic concurrent movement','draft');
insert into public.divisions(id,season_id,name) values
 ('91919191-0000-0000-0000-000000000020','91919191-0000-0000-0000-000000000010','Race division');
insert into public.teams(id,division_id,name,player_one_name,player_two_name,player_one_email,player_two_email) values
 ('91919191-0000-0000-0000-000000000030','91919191-0000-0000-0000-000000000020','Race pairing','Race One','Race Two','race-one@example.invalid','race-two@example.invalid');
"""
result = sql(setup)
assert result.returncode == 0, result.stderr
query = """begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
set local role authenticated;
select public.rallora_manage_players('standby','91919191-0000-0000-0000-000000000030',1,0);
select pg_sleep(1);
commit;"""
commands = [subprocess.Popen(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-Atc', query], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(2)]
outputs = [command.communicate(timeout=30) for command in commands]
assert sorted(command.returncode for command in commands) == [0, 1], outputs
assert any('pairing changed' in error for _, error in outputs), outputs
result = sql("""
select count(*) from public.rallora_player_movements where season_id='91919191-0000-0000-0000-000000000010';
select count(*) from public.rallora_player_pools where season_id='91919191-0000-0000-0000-000000000010' and status='available';
select roster_version from public.teams where id='91919191-0000-0000-0000-000000000030';
""")
assert result.returncode == 0 and result.stdout.strip().splitlines() == ['1', '1', '1'], (result.stdout, result.stderr)
print('PASS: two concurrent confirmations produce one movement, one standby record and one version increment')
