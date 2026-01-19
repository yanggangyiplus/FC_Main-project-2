import os
import glob

# 현재 디렉토리
print(f"Current directory: {os.getcwd()}")

# .db 파일 찾기
db_files = glob.glob("**/*.db", recursive=True)
print(f"DB files in current dir: {db_files}")

# 상위 디렉토리도 검색
db_files_parent = glob.glob("../**/*.db", recursive=True)
print(f"DB files in parent: {db_files_parent}")

# always-plan.db 직접 확인
if os.path.exists("always-plan.db"):
    print("always-plan.db EXISTS in current directory")
    print(f"Size: {os.path.getsize('always-plan.db')} bytes")
else:
    print("always-plan.db NOT FOUND in current directory")

# 숨김 파일 포함 모든 파일 목록
print("\nAll files in current directory:")
for f in os.listdir("."):
    if f.endswith(".db"):
        print(f"  {f} - {os.path.getsize(f)} bytes")
