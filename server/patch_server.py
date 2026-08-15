import re

filepath = 'server.js'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def add_filter(line):
    # If already has isDeleted, skip
    if 'isDeleted' in line:
        return line
        
    # Match .find({ ... }) or .findOne({ ... })
    # We'll use a simple string replacement for the common patterns
    if '.find({' in line:
        return line.replace('.find({', '.find({ isDeleted: { $ne: true }, ')
    elif '.findOne({' in line:
        return line.replace('.findOne({', '.findOne({ isDeleted: { $ne: true }, ')
    elif '.find()' in line:
        return line.replace('.find()', '.find({ isDeleted: { $ne: true } })')
    elif '.findOne()' in line:
        return line.replace('.findOne()', '.findOne({ isDeleted: { $ne: true } })')
    elif '.find(query)' in line:
        # We need to inject into 'query' variable, not here.
        # But for 'query', we can let it be, and modify where 'query' is defined.
        return line
    elif '.find(buildTestLookup' in line or '.findOne(buildTestLookup' in line:
        # buildTestLookup is used. We should modify buildTestLookup function!
        return line
    return line

new_lines = []
for i, line in enumerate(lines):
    # Only modify lines that contain mongoose model calls
    if re.search(r'\b(Institute|User|Student|Test|TestResult|Attendance|SMSLog)\.(find|findOne)\b', line):
        new_lines.append(add_filter(line))
    else:
        new_lines.append(line)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Patched server.js")
