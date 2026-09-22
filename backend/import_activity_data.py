import os
import zipfile
import xml.etree.ElementTree as ET
import psycopg2
from psycopg2 import sql

EXCEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'synthetic_activity_data_updated(1).xlsx')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'focusguard')
DB_USER = os.getenv('DB_USER', 'focusguard')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'focusguard123')


def load_sheet_rows():
    with zipfile.ZipFile(EXCEL_PATH) as z:
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            ns = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            for si in root.findall('a:si', ns):
                text = ''.join(t.text or '' for t in si.iterfind('.//a:t', ns))
                shared_strings.append(text)

        ns = {
            'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
            'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        }
        sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        rows = []
        for row in sheet.findall('.//a:sheetData/a:row', ns):
            cells = []
            for cell in row.findall('a:c', ns):
                value = ''
                if cell.find('a:v', ns) is not None:
                    value = cell.find('a:v', ns).text or ''
                if cell.attrib.get('t') == 's' and value.isdigit():
                    value = shared_strings[int(value)] if int(value) < len(shared_strings) else ''
                cells.append(value)
            rows.append(cells)
        return rows


def create_table(conn):
    with conn.cursor() as cur:
        cur.execute('''
            CREATE TABLE IF NOT EXISTS synthetic_activity_data (
                id SERIAL PRIMARY KEY,
                pid TEXT,
                user_type TEXT,
                user_access_type TEXT,
                limit_status TEXT,
                app_website_name TEXT,
                url TEXT,
                category TEXT,
                opened_datetime TEXT,
                closed_datetime TEXT,
                duration_closed_opened TEXT,
                status TEXT,
                productive_nonproductive TEXT,
                app_switch TEXT,
                monitored TEXT,
                monitoring_scope TEXT
            )
        ''')
        conn.commit()


def insert_rows(conn, rows):
    if not rows:
        return
    headers = [
        'pid', 'user_type', 'user_access_type', 'limit_status', 'app_website_name', 'url', 'category',
        'opened_datetime', 'closed_datetime', 'duration_closed_opened', 'status', 'productive_nonproductive',
        'app_switch', 'monitored', 'monitoring_scope'
    ]
    data_rows = rows[1:]
    with conn.cursor() as cur:
        cur.execute('TRUNCATE TABLE synthetic_activity_data RESTART IDENTITY')
        for row in data_rows:
            values = row[:len(headers)]
            if len(values) < len(headers):
                values += [''] * (len(headers) - len(values))
            cur.execute(
                sql.SQL('INSERT INTO synthetic_activity_data ({}) VALUES ({})').format(
                    sql.SQL(', ').join(sql.Identifier(h) for h in headers),
                    sql.SQL(', ').join(sql.Placeholder() for _ in headers)
                ),
                values
            )
        conn.commit()


def main():
    rows = load_sheet_rows()
    if not rows:
        raise SystemExit('No data found in Excel file')

    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD, dbname=DB_NAME)
    create_table(conn)
    insert_rows(conn, rows)
    conn.close()
    print('Imported', len(rows) - 1, 'rows into PostgreSQL')


if __name__ == '__main__':
    main()
