import sqlite3


def check_stuck_actions():
    conn = sqlite3.connect("data/homelab.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print("--- Actions in EXECUTING or PENDING state ---")
    rows = cursor.execute("""
        SELECT id, server_id, type, status, started_at, completed_at, error
        FROM actions
        WHERE status IN ('EXECUTING', 'PENDING')
        ORDER BY started_at DESC
    """).fetchall()

    if not rows:
        print("No stuck actions found in DB.")
    else:
        for row in rows:
            print(dict(row))

    conn.close()


if __name__ == "__main__":
    check_stuck_actions()
