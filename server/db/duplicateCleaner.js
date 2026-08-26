import mongoose from 'mongoose';
import { logInfo, logError, logWarn } from '../utils/logger.js';

function normalizeRoll(r) {
  let str = String(r || '').trim();
  if (str.length === 5 && str.startsWith('1')) {
    str = str.slice(1);
  }
  return str;
}

function cleanName(n) {
  return String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanPhone(p) {
  return String(p || '').replace(/\D/g, '').slice(-10);
}

export async function mergeDuplicatesOnDb(dbInstance, dbLabel = 'DB') {
  try {
    const studentColl = dbInstance.collection('students');
    const attColl = dbInstance.collection('attendances');
    const testResColl = dbInstance.collection('testresults');
    const smsColl = dbInstance.collection('smslogs');
    const userColl = dbInstance.collection('users');

    const allStudents = await studentColl.find({ isDeleted: { $ne: true } }).toArray();
    if (!allStudents || allStudents.length === 0) return { mergedCount: 0, finalCount: 0 };

    const parentMap = new Map();
    function find(id) {
      if (!parentMap.has(id)) parentMap.set(id, id);
      if (parentMap.get(id) === id) return id;
      const root = find(parentMap.get(id));
      parentMap.set(id, root);
      return root;
    }
    function union(idA, idB) {
      const rootA = find(idA);
      const rootB = find(idB);
      if (rootA !== rootB) parentMap.set(rootB, rootA);
    }

    const phoneRollMap = new Map();
    const nameRollMap = new Map();
    const phoneNameMap = new Map();

    for (const s of allStudents) {
      const id = String(s._id);
      const normRoll = normalizeRoll(s.rollNo);
      const cName = cleanName(s.name);
      const cPhone = cleanPhone(s.parentPhone);

      if (cPhone && cPhone.length === 10 && normRoll) {
        const key = `${cPhone}_${normRoll}`;
        if (phoneRollMap.has(key)) union(id, phoneRollMap.get(key));
        else phoneRollMap.set(key, id);
      }

      if (cName && cName.length > 2 && normRoll) {
        const key = `${cName}_${normRoll}`;
        if (nameRollMap.has(key)) union(id, nameRollMap.get(key));
        else nameRollMap.set(key, id);
      }

      if (cPhone && cPhone.length === 10 && cName && cName.length > 2) {
        const key = `${cPhone}_${cName}`;
        if (phoneNameMap.has(key)) union(id, phoneNameMap.get(key));
        else phoneNameMap.set(key, id);
      }
    }

    const clusters = new Map();
    for (const s of allStudents) {
      const root = find(String(s._id));
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(s);
    }

    const duplicateClusters = Array.from(clusters.values()).filter(list => list.length > 1);
    let mergedCount = 0;
    let deletedCount = 0;

    for (const cluster of duplicateClusters) {
      cluster.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        if (a.photo && a.photo.length > 5) scoreA += 10;
        if (b.photo && b.photo.length > 5) scoreB += 10;
        if (String(a.rollNo).length <= 4) scoreA += 5;
        if (String(b.rollNo).length <= 4) scoreB += 5;
        if (a.parentName) scoreA += 2;
        if (b.parentName) scoreB += 2;
        return scoreB - scoreA;
      });

      const primary = cluster[0];
      const duplicates = cluster.slice(1);
      const norm4DigitRoll = normalizeRoll(primary.rollNo) || normalizeRoll(duplicates[0].rollNo);
      const newParentUserId = `CAREER${norm4DigitRoll}`;
      const newParentPass = norm4DigitRoll;

      const allStudentIds = new Set();
      const allRollNos = new Set();
      const duplicateMongoIds = [];
      const oldParentUsernames = new Set();

      cluster.forEach(s => {
        if (s.id) allStudentIds.add(s.id);
        if (s._id) allStudentIds.add(String(s._id));
        if (s.rollNo) {
          allRollNos.add(String(s.rollNo));
          allRollNos.add(normalizeRoll(s.rollNo));
        }
        if (s.parentUserId) oldParentUsernames.add(s.parentUserId);
      });

      duplicates.forEach(d => duplicateMongoIds.push(d._id));

      const updateFields = {
        rollNo: norm4DigitRoll,
        parentUserId: newParentUserId,
        parentPasswordPlain: newParentPass
      };

      duplicates.forEach(d => {
        if (!primary.photo && d.photo) updateFields.photo = d.photo;
        if (!primary.parentName && d.parentName) updateFields.parentName = d.parentName;
        if (!primary.parentPhone && d.parentPhone) updateFields.parentPhone = d.parentPhone;
        if (!primary.parentPhone2 && d.parentPhone2) updateFields.parentPhone2 = d.parentPhone2;
        if (!primary.class && d.class) updateFields.class = d.class;
        if (!primary.address && d.address) updateFields.address = d.address;
        if (!primary.schoolName && d.schoolName) updateFields.schoolName = d.schoolName;
      });

      // Update primary record
      await studentColl.updateOne({ _id: primary._id }, { $set: updateFields });

      // Re-point related collections
      const idList = Array.from(allStudentIds);
      const rollList = Array.from(allRollNos);

      await Promise.allSettled([
        attColl.updateMany({ $or: [{ studentId: { $in: idList } }, { rollNo: { $in: rollList } }] }, { $set: { studentId: primary.id, rollNo: norm4DigitRoll } }),
        testResColl.updateMany({ $or: [{ studentId: { $in: idList } }, { rollNo: { $in: rollList } }] }, { $set: { studentId: primary.id, rollNo: norm4DigitRoll } }),
        smsColl.updateMany({ $or: [{ studentId: { $in: idList } }, { rollNo: { $in: rollList } }] }, { $set: { studentId: primary.id, rollNo: norm4DigitRoll } })
      ]);

      // Delete duplicates
      if (duplicateMongoIds.length > 0) {
        await studentColl.deleteMany({ _id: { $in: duplicateMongoIds } });
        deletedCount += duplicateMongoIds.length;
      }

      if (oldParentUsernames.size > 0) {
        await userColl.deleteMany({ username: { $in: Array.from(oldParentUsernames), $ne: newParentUserId } });
      }

      mergedCount++;
    }

    // Normalize any non-duplicate 5-digit rolls
    const remaining5Digit = await studentColl.find({ isDeleted: { $ne: true }, rollNo: { $regex: /^1\d{4}$/ } }).toArray();
    if (remaining5Digit.length > 0) {
      const ops = remaining5Digit.map(s => {
        const four = normalizeRoll(s.rollNo);
        return {
          updateOne: {
            filter: { _id: s._id },
            update: {
              $set: {
                rollNo: four,
                parentUserId: `CAREER${four}`,
                parentPasswordPlain: four
              }
            }
          }
        };
      });
      await studentColl.bulkWrite(ops, { ordered: false });
    }

    const finalTotal = await studentColl.countDocuments({ isDeleted: { $ne: true } });
    logInfo('DEDUP', `[${dbLabel}] Dedup complete: Merged ${mergedCount} clusters, deleted ${deletedCount} duplicates. Final Active: ${finalTotal}`);
    return { mergedCount, deletedCount, finalTotal };
  } catch (err) {
    logError('DEDUP', `Error during dedup on [${dbLabel}]`, err);
    throw err;
  }
}
