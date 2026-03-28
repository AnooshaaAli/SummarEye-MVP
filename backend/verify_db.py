import os
from sqlalchemy import inspect
from database import engine, Video, Event, init_db

def verify():
    print("Initializing DB...")
    init_db()
    
    # Check if file exists
    db_path = "./SummarEye.db"
    print(f"DB file exists: {os.path.exists(db_path)}")
    
    # List tables and columns
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print("\nTables found:", tables)
    
    for table in tables:
        print(f"\nSchema for '{table}':")
        columns = inspector.get_columns(table)
        for col in columns:
            print(f"  - {col['name']} ({col['type']}) {'[PK]' if col.get('primary_key') else ''}")

    from sqlalchemy.orm import Session

    print("\nTesting before_insert event listener...")
    with Session(engine) as session:
        test_video = Video(filename="test.mp4", filepath="/uploads/test.mp4")
        session.add(test_video)
        session.commit()
        
        test_event = Event(
            video_id=test_video.id,
            start_time=10.5,
            end_time=30.0,
            label="person_detected",
            confidence=0.9
        )
        session.add(test_event)
        session.commit()
        
        print(f"Inserted event duration computed: {test_event.duration_s}")
        assert test_event.duration_s == 19.5, "Duration mismatch!"
        
        # Cleanup
        session.delete(test_event)
        session.delete(test_video)
        session.commit()

if __name__ == "__main__":
    verify()
