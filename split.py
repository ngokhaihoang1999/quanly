import codecs
import re

with codecs.open("mini-app/app.js", "r", "utf-8") as f:
    content = f.read()

def get_part(start_str, end_str=None):
    start = content.find(start_str)
    if end_str:
        end = content.find(end_str, start)
        return content[start:end]
    return content[start:]

dashboard = get_part("// ============ DASHBOARD ============", "// ============ PROFILES ============")
profiles = get_part("// ============ PROFILES ============", "// ============ NAVIGATION ============")
records = get_part("// ============ CONSULTATION SESSIONS ============", "// ============ STAFF ============")
# but CHECK HAPJA is inside records? Let's fix that.
hapja = get_part("// ============ CHECK HAPJA ============", "// ============ ADD RECORD MODAL ============")
records = get_part("// ============ CONSULTATION SESSIONS ============", "// ============ CHECK HAPJA ============") + get_part("// ============ ADD RECORD MODAL ============", "// ============ STAFF ============")
staff = get_part("// ============ STAFF ============", "// ============ STRUCTURE ============")
structure = get_part("// ============ STRUCTURE ============", "// ============ MODAL CLOSE ON OVERLAY CLICK ============")

# Core.js: manual synthesis from file sections plus header
core_top = content[:content.find("// ============ DASHBOARD ============")]
core_nav = get_part("// ============ NAVIGATION ============", "// ============ CONSULTATION SESSIONS ============")
core_bottom = get_part("// ============ MODAL CLOSE ON OVERLAY CLICK ============")

# Add missing global variables that were in PROFILES or CONSULTATION SESSIONS
# Let's adjust globals directly in the extracted string
core_top = core_top.replace("let currentProfileId = null, currentRecordType = null;", "let currentProfileId = null, currentRecordType = null, currentRecordId = null;")
core_top = core_top.replace("let allProfiles = [], allStaff = [], myStaff = null;", "let allProfiles = [], allStaff = [], myStaff = null, structureData = [];")

# Remove those let statements from profiles.js and records.js & structure.js
profiles = re.sub(r"let currentRecordId = null;\r?\n", "", profiles)
records = re.sub(r"let currentRecordId = null;\r?\n", "", records)
structure = re.sub(r"let structureData = \[\];\r?\n", "", structure)

# duplicated helper fix in structure.js 
structure = re.sub(r"function getStaffCodeFromInput\(id\) \{[^\}]+\}\r?\n", "", structure)
structure = re.sub(r"function setStaffInputValue\(id, code\) \{[^\}]+\}\r?\n", "", structure)


core_content = core_top + core_nav + core_bottom

# Add unit popup, fruit toggle to dashboard since we want them there, or keep in core? 
# They are in core_bottom already!! Which is fine, let's keep them in core to make it easy.
# Wait, let's see where UNIT POPUP and FRUIT STATUS TOGGLE are:
# They are in core_bottom. It's perfectly fine to leave them in core.js for now.

with codecs.open("mini-app/core.js", "w", "utf-8") as f: f.write(core_content)
with codecs.open("mini-app/dashboard.js", "w", "utf-8") as f: f.write(dashboard)
with codecs.open("mini-app/profiles.js", "w", "utf-8") as f: f.write(profiles)
with codecs.open("mini-app/hapja.js", "w", "utf-8") as f: f.write(hapja)
with codecs.open("mini-app/records.js", "w", "utf-8") as f: f.write(records)
with codecs.open("mini-app/staff.js", "w", "utf-8") as f: f.write(staff)
with codecs.open("mini-app/structure.js", "w", "utf-8") as f: f.write(structure)

print("Files created.")
