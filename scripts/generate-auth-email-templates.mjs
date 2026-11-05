import fs from 'node:fs';
import {AUTH_EMAIL_DEFINITIONS,renderAuthEmail,authEmailTemplateConfig} from '../lib/email-templates.ts';
const directory=new URL('../supabase/templates/auth/',import.meta.url);
fs.mkdirSync(directory,{recursive:true});
for(const type of Object.keys(AUTH_EMAIL_DEFINITIONS))fs.writeFileSync(new URL(type+'.html',directory),renderAuthEmail(type).html+'\n');
fs.writeFileSync(new URL('hosted-config.json',directory),JSON.stringify(authEmailTemplateConfig(),null,2)+'\n');
console.log(`Generated ${Object.keys(AUTH_EMAIL_DEFINITIONS).length} Rallora account-email templates. Apply through hosted Auth settings; generating files does not change live emails.`);
