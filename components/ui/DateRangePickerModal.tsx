import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface DateRangePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectRange: (startDate: Date, endDate: Date) => void;
}

export const DateRangePickerModal: React.FC<DateRangePickerModalProps> = ({
  visible,
  onClose,
  onSelectRange,
}) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calendar calculations
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  // 1-indexed days
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const daysGrid: (Date | null)[] = [];
  
  // Padding for start day of the week
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push(null);
  }

  // Days of the month
  for (let i = 1; i <= totalDays; i++) {
    daysGrid.push(new Date(year, month, i));
  }

  // Select Date handler
  const handleSelectDate = (date: Date) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(null);
    } else if (startDate && !endDate) {
      if (date < startDate) {
        setStartDate(date);
        setEndDate(null);
      } else {
        setEndDate(date);
      }
    }
  };

  const handleApply = () => {
    if (startDate && endDate) {
      onSelectRange(startDate, endDate);
      onClose();
    } else if (startDate) {
      // If only start date is selected, treat it as a 1-day range
      onSelectRange(startDate, startDate);
      onClose();
    }
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
  };

  // Check if a date is selected
  const isStartDate = (date: Date) => {
    return startDate && date.toDateString() === startDate.toDateString();
  };

  const isEndDate = (date: Date) => {
    return endDate && date.toDateString() === endDate.toDateString();
  };

  const isDateInRange = (date: Date) => {
    if (!startDate || !endDate) return false;
    return date > startDate && date < endDate;
  };

  const formatDateString = (date: Date | null) => {
    if (!date) return '-';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Date Range</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#A0A0B0" />
            </TouchableOpacity>
          </View>

          {/* Range Preview */}
          <View style={styles.rangePreview}>
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>FROM</Text>
              <Text style={[styles.previewValue, startDate && styles.activeValue]}>
                {formatDateString(startDate)}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="#D4AF37" style={{ marginHorizontal: 8 }} />
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>TO</Text>
              <Text style={[styles.previewValue, endDate && styles.activeValue]}>
                {formatDateString(endDate)}
              </Text>
            </View>
          </View>

          {/* Month Selector */}
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn}>
              <Ionicons name="chevron-back" size={20} color="#D4AF37" />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {monthNames[month]} {year}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn}>
              <Ionicons name="chevron-forward" size={20} color="#D4AF37" />
            </TouchableOpacity>
          </View>

          {/* Weekday Names */}
          <View style={styles.weekdaysRow}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <Text key={day} style={styles.weekdayText}>
                {day}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {daysGrid.map((date, index) => {
              if (!date) {
                return <View key={`empty-${index}`} style={styles.dayCellPlaceholder} />;
              }

              const start = isStartDate(date);
              const end = isEndDate(date);
              const inRange = isDateInRange(date);

              return (
                <TouchableOpacity
                  key={date.toISOString()}
                  onPress={() => handleSelectDate(date)}
                  activeOpacity={0.7}
                  style={[
                    styles.dayCell,
                    start && styles.startDayCell,
                    end && styles.endDayCell,
                    inRange && styles.inRangeDayCell,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      (start || end) && styles.selectedDayText,
                      inRange && styles.inRangeDayText,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <View style={styles.footerRight}>
              <TouchableOpacity onPress={onClose} style={[styles.footerBtn, styles.cancelBtn]}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApply}
                disabled={!startDate}
                style={[styles.footerBtn, styles.applyBtn, !startDate && styles.disabledApplyBtn]}
              >
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#24242a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    width: '100%',
    maxWidth: 360,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  rangePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#191820',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  previewBox: {
    flex: 1,
    alignItems: 'center',
  },
  previewLabel: {
    color: '#6e6e7c',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
  },
  previewValue: {
    color: '#A0A0B0',
    fontSize: 13,
    fontWeight: '600',
  },
  activeValue: {
    color: '#D4AF37',
    fontWeight: '700',
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthNavBtn: {
    padding: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 8,
  },
  monthLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekdayText: {
    color: '#6e6e7c',
    fontSize: 11,
    fontWeight: '700',
    width: 40,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dayCell: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 8,
  },
  dayCellPlaceholder: {
    width: 40,
    height: 40,
    marginVertical: 2,
  },
  dayText: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '600',
  },
  startDayCell: {
    backgroundColor: '#D4AF37',
    borderRadius: 8,
  },
  endDayCell: {
    backgroundColor: '#D4AF37',
    borderRadius: 8,
  },
  inRangeDayCell: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderRadius: 0,
  },
  selectedDayText: {
    color: '#191820',
    fontWeight: '800',
  },
  inRangeDayText: {
    color: '#D4AF37',
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 12,
  },
  clearBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearBtnText: {
    color: '#FF4B4B',
    fontSize: 13,
    fontWeight: '600',
  },
  footerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  footerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cancelBtnText: {
    color: '#A0A0B0',
    fontSize: 13,
    fontWeight: '600',
  },
  applyBtn: {
    backgroundColor: '#D4AF37',
  },
  disabledApplyBtn: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  applyBtnText: {
    color: '#191820',
    fontSize: 13,
    fontWeight: '700',
  },
});
