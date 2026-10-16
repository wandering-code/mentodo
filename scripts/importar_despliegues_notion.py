"""(Usado una vez el 2026-10-16; base para la importación general de Notion, #10)

Importa los despliegues exportados de Notion a Mentodo (producción).

Uso: python3 importar_despliegues.py <cookie_jar> <fecha dd/mm/yyyy> [...]
     python3 importar_despliegues.py <cookie_jar> --todos
     (--dry para ver el contenido convertido sin crear nada)
"""
import json
import os
import re
import subprocess
import sys
import urllib.parse

BASE = 'https://mentodo.wanderingcode.dev/api'
DIR = '/Users/wander/repos/mentodo/despliegues/Despliegues/Tareas sin tarjeta específica (1)'
PROJECT, TEMPLATE = 1, 37
STATUS_DESPLIEGUES = 12            # columna «Despliegues» (no cuenta)
F_ENTREGA, F_OFICIAL = '1', '4'    # Fecha de entrega, Oficial


def api(jar, method, path, body=None):
    cmd = ['curl', '-sS', '-b', jar, '-X', method, BASE + path, '-H', 'content-type: application/json']
    if body is not None:
        cmd += ['-d', json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def upload(jar, card_id, path):
    out = subprocess.run(['curl', '-sS', '-b', jar, '-F', f'file=@{path}', '-F', f'card_id={card_id}', BASE + '/attachments'],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


# ── Markdown de Notion → documento de TipTap ────────────────────────────────

INLINE = re.compile(r'\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)')


def inline(text):
    nodes, pos = [], 0
    for m in INLINE.finditer(text):
        if m.start() > pos:
            nodes.append({'type': 'text', 'text': text[pos:m.start()]})
        if m.group(1) is not None:
            nodes.append({'type': 'text', 'text': m.group(1), 'marks': [{'type': 'bold'}]})
        else:
            nodes.append({'type': 'text', 'text': m.group(2), 'marks': [{'type': 'link', 'attrs': {'href': m.group(3)}}]})
        pos = m.end()
    if pos < len(text):
        nodes.append({'type': 'text', 'text': text[pos:]})
    return [n for n in nodes if n['text']]


def para(text):
    c = inline(text)
    return {'type': 'paragraph', 'content': c} if c else {'type': 'paragraph'}


ITEM = re.compile(r'^(\s*)- (\[( |x)\]\s+)?(.*)$')


def parse_items(lines, i, indent):
    """Lista desde la línea i con sangría `indent`. Devuelve (nodos, i)."""
    out = []
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        m = ITEM.match(line)
        if not m or len(m.group(1)) < indent:
            break
        if len(m.group(1)) > indent:  # hija sin padre: se cuelga del anterior
            break
        task = m.group(2) is not None
        item = {'type': 'taskItem' if task else 'listItem', 'content': [para(m.group(4).strip())]}
        if task:
            item['attrs'] = {'checked': m.group(3) == 'x'}
        i += 1
        # Hijas (más sangría)
        while i < len(lines):
            nxt = lines[i]
            if not nxt.strip():
                i += 1
                continue
            mm = ITEM.match(nxt)
            if mm and len(mm.group(1)) > indent:
                kids, i = parse_items(lines, i, len(mm.group(1)))
                item['content'].extend(kids)
            else:
                break
        kind = 'taskList' if task else 'bulletList'
        if out and out[-1]['type'] == kind:
            out[-1]['content'].append(item)
        else:
            out.append({'type': kind, 'content': [item]})
    return out, i


def to_doc(body_lines):
    blocks, i = [], 0
    while i < len(body_lines):
        line = body_lines[i]
        if not line.strip():
            i += 1
            continue
        m = ITEM.match(line)
        if m:
            lists, i = parse_items(body_lines, i, len(m.group(1)))
            blocks.extend(lists)
        else:
            blocks.append(para(line.strip()))
            i += 1
    return {'type': 'doc', 'content': blocks or [{'type': 'paragraph'}]}


def read_page(path):
    lines = open(path, encoding='utf-8').read().splitlines()
    title = lines[0].lstrip('# ').strip()
    oficial, body, files = False, [], []
    for line in lines[1:]:
        if line.startswith('Creado:'):
            continue
        if line.startswith('Oficial:'):
            oficial = line.split(':', 1)[1].strip().lower().startswith('s')
            continue
        # Enlace a un fichero exportado junto a la página → adjunto
        fm = re.fullmatch(r'\[([^\]]+)\]\(([^)]+)\)', line.strip())
        if fm and not fm.group(2).startswith('http'):
            files.append(os.path.join(DIR, urllib.parse.unquote(fm.group(2))))
            continue
        body.append(line)
    return title, oficial, to_doc(body), files


def pages():
    out = {}
    for name in os.listdir(DIR):
        if name.endswith('.md') and re.match(r'\d\d \d\d \d{4} ', name):
            d, m, y = name[:10].split(' ')
            out[f'{d}/{m}/{y}'] = os.path.join(DIR, name)
    return out


INDEX = '/Users/wander/repos/mentodo/despliegues/Despliegues 3c8a4fa41daf8036a4a3fa4d559b0059.md'
ENTRY = re.compile(r'^- (\d\d/\d\d/\d{4})\s*(?:\((.*)\))?\s*$')


def index_entries():
    """Despliegues de la lista del índice (2024): {fecha: (nota, líneas)}"""
    out, cur = {}, None
    for line in open(INDEX, encoding='utf-8').read().splitlines():
        m = ENTRY.match(line)
        if m:
            cur = m.group(1)
            out[cur] = (m.group(2), [])
        elif cur and line.startswith('    '):
            out[cur][1].append(line[4:])
        elif cur and line.strip() and not line.startswith(' '):
            cur = None
    return out


def import_one(jar, date, path, dry=False):
    if isinstance(path, tuple):  # de la lista del índice
        note, lines = path
        title, oficial, files = date, None, []
        doc = to_doc(([note[0].upper() + note[1:]] if note else []) + lines)
    else:
        title, oficial, doc, files = read_page(path)
    d, m, y = date.split('/')
    at = f'{y}-{m}-{d}T10:00:00+00:00'  # todo el día (mediodía en Madrid)
    if dry:
        print(json.dumps({'title': title, 'oficial': oficial, 'files': files, 'doc': doc}, ensure_ascii=False, indent=1))
        return None
    c = api(jar, 'POST', f'/cards/from-template/{TEMPLATE}', {'project_id': PROJECT, 'label_ids': [STATUS_DESPLIEGUES]})
    patch = {'title': title, 'content': doc, 'in_todo': False,
             'values': {F_ENTREGA: {'at': at, 'all_day': True}, F_OFICIAL: True if oficial else None}}
    if oficial is None:  # sin dato de «Oficial»: no se muestra (ni verde ni rojo)
        patch['extra_props'] = []
    c = api(jar, 'PATCH', f"/cards/{c['id']}", patch)
    for f in files:
        upload(jar, c['id'], f)
    return c


if __name__ == '__main__':
    jar, args = sys.argv[1], sys.argv[2:]
    dry = '--dry' in args
    args = [a for a in args if a != '--dry']
    all_pages = pages()
    if '--indice' in args:  # los de la lista, salvo los que tienen página propia
        args = [a for a in args if a != '--indice']
        for d, v in index_entries().items():
            all_pages.setdefault(d, v)
    dates = sorted(all_pages, key=lambda s: s[6:] + s[3:5] + s[:2]) if args == ['--todos'] else args
    # No duplicar: fechas ya importadas (tarjetas con ese título en la columna)
    boot = api(jar, 'GET', '/bootstrap')
    done = {c['title'] for c in boot['cards'] if STATUS_DESPLIEGUES in c['label_ids']}
    for date in dates:
        if date in done and not dry:
            print(f'{date}: ya estaba, se salta')
            continue
        c = import_one(jar, date, all_pages[date], dry)
        if c:
            print(f"{date}: tarjeta {c['id']} creada")
