"""Two independent leagues can activate concurrently without completing each other."""
import subprocess


def sql(query):
    return subprocess.run(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-Atc', query], capture_output=True, text=True)


setup = """
insert into public.clubs(id,slug,name) values
 ('92929292-0000-0000-0000-000000000001','parallel-activation-race','Synthetic parallel activation');
insert into public.seasons(id,club_id,name,status) values
 ('92929292-0000-0000-0000-000000000010','92929292-0000-0000-0000-000000000001','Winter race','draft'),
 ('92929292-0000-0000-0000-000000000011','92929292-0000-0000-0000-000000000001','Ladies race','draft');
insert into public.divisions(id,season_id,name) values
 ('92929292-0000-0000-0000-000000000020','92929292-0000-0000-0000-000000000010','Winter'),
 ('92929292-0000-0000-0000-000000000021','92929292-0000-0000-0000-000000000011','Ladies');
insert into public.teams(id,division_id,name,player_one_name,player_two_name) values
 ('92929292-0000-0000-0000-000000000030','92929292-0000-0000-0000-000000000020','Winter one','W1','W2'),
 ('92929292-0000-0000-0000-000000000031','92929292-0000-0000-0000-000000000020','Winter two','W3','W4'),
 ('92929292-0000-0000-0000-000000000032','92929292-0000-0000-0000-000000000021','Ladies one','L1','L2'),
 ('92929292-0000-0000-0000-000000000033','92929292-0000-0000-0000-000000000021','Ladies two','L3','L4');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',false);
select public.rallora_generate_round_robin('92929292-0000-0000-0000-000000000010',current_date,current_date+29);
select public.rallora_generate_round_robin('92929292-0000-0000-0000-000000000011',current_date,current_date+29);
"""
result = sql(setup)
assert result.returncode == 0, result.stderr
commands = []
for season in ['92929292-0000-0000-0000-000000000010', '92929292-0000-0000-0000-000000000011']:
    query = f"""begin;
set local lock_timeout='5s';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
set local role authenticated;
select public.rallora_set_season_status('{season}','active');
select pg_sleep(0.25);
commit;"""
    commands.append(subprocess.Popen(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-Atc', query], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True))
outputs = [command.communicate(timeout=20) for command in commands]
assert all(command.returncode == 0 for command in commands), outputs
result = sql("select count(*) from public.seasons where club_id='92929292-0000-0000-0000-000000000001' and status='active';")
assert result.returncode == 0 and result.stdout.strip() == '2', (result.stdout, result.stderr)
print('PASS: simultaneous Winter and Ladies activation preserves both active leagues')
