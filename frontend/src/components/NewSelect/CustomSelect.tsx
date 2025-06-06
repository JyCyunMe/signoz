/* eslint-disable no-nested-ternary */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/function-component-definition */
import './styles.scss';

import {
	CloseOutlined,
	DownOutlined,
	LoadingOutlined,
	ReloadOutlined,
} from '@ant-design/icons';
import { Color } from '@signozhq/design-tokens';
import { Select } from 'antd';
import cx from 'classnames';
import { SOMETHING_WENT_WRONG } from 'constants/api';
import { capitalize, isEmpty } from 'lodash-es';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { BaseSelectRef } from 'rc-select';
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { popupContainer } from 'utils/selectPopupContainer';

import { CustomSelectProps, OptionData } from './types';
import {
	filterOptionsBySearch,
	prioritizeOrAddOptionForSingleSelect,
	SPACEKEY,
} from './utils';

/**
 * CustomSelect Component
 *
 */
const CustomSelect: React.FC<CustomSelectProps> = ({
	placeholder = 'Search...',
	className,
	loading = false,
	onSearch,
	options = [],
	value,
	onChange,
	defaultActiveFirstOption = true,
	noDataMessage,
	onClear,
	getPopupContainer,
	dropdownRender,
	highlightSearch = true,
	placement = 'bottomLeft',
	popupMatchSelectWidth = true,
	popupClassName,
	errorMessage,
	allowClear = false,
	onRetry,
	...rest
}) => {
	// ===== State & Refs =====
	const [isOpen, setIsOpen] = useState(false);
	const [searchText, setSearchText] = useState('');
	const [activeOptionIndex, setActiveOptionIndex] = useState<number>(-1);

	// Refs for element access and scroll behavior
	const selectRef = useRef<BaseSelectRef>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const optionRefs = useRef<Record<number, HTMLDivElement | null>>({});

	// ===== Option Filtering & Processing Utilities =====

	/**
	 * Checks if a label exists in the provided options
	 */
	const isLabelPresent = useCallback(
		(options: OptionData[], label: string): boolean =>
			options.some((option) => {
				const lowerLabel = label.toLowerCase();

				// Check in nested options if they exist
				if ('options' in option && Array.isArray(option.options)) {
					return option.options.some(
						(subOption) => subOption.label.toLowerCase() === lowerLabel,
					);
				}

				// Check top-level option
				return option.label.toLowerCase() === lowerLabel;
			}),
		[],
	);

	/**
	 * Separates section and non-section options
	 */
	const splitOptions = useCallback((options: OptionData[]): {
		sectionOptions: OptionData[];
		nonSectionOptions: OptionData[];
	} => {
		const sectionOptions: OptionData[] = [];
		const nonSectionOptions: OptionData[] = [];

		options.forEach((option) => {
			if ('options' in option && Array.isArray(option.options)) {
				sectionOptions.push(option);
			} else {
				nonSectionOptions.push(option);
			}
		});

		return { sectionOptions, nonSectionOptions };
	}, []);

	/**
	 * Apply search filtering to options
	 */
	const filteredOptions = useMemo(
		(): OptionData[] => filterOptionsBySearch(options, searchText),
		[options, searchText],
	);

	// ===== UI & Rendering Functions =====

	/**
	 * Highlights matched text in search results
	 */
	const highlightMatchedText = useCallback(
		(text: string, searchQuery: string): React.ReactNode => {
			if (!searchQuery || !highlightSearch) return text;

			const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
			return (
				<>
					{parts.map((part, i) => {
						// Create a deterministic but unique key
						const uniqueKey = `${text.substring(0, 3)}-${part.substring(0, 3)}-${i}`;

						return part.toLowerCase() === searchQuery.toLowerCase() ? (
							<span key={uniqueKey} className="highlight-text">
								{part}
							</span>
						) : (
							part
						);
					})}
				</>
			);
		},
		[highlightSearch],
	);

	/**
	 * Renders an individual option with proper keyboard navigation support
	 */
	const renderOptionItem = useCallback(
		(
			option: OptionData,
			isSelected: boolean,
			index?: number,
		): React.ReactElement => {
			const handleSelection = (): void => {
				if (onChange) {
					onChange(option.value, option);
					setIsOpen(false);
				}
			};

			const isActive = index === activeOptionIndex;
			const optionId = `option-${index}`;

			return (
				<div
					key={option.value}
					id={optionId}
					ref={(el): void => {
						if (index !== undefined) {
							optionRefs.current[index] = el;
						}
					}}
					className={cx('option-item', {
						selected: isSelected,
						active: isActive,
					})}
					onClick={(e): void => {
						e.stopPropagation();
						handleSelection();
					}}
					onKeyDown={(e): void => {
						if (e.key === 'Enter' || e.key === SPACEKEY) {
							e.preventDefault();
							handleSelection();
						}
					}}
					onMouseEnter={(): void => setActiveOptionIndex(index || -1)}
					role="option"
					aria-selected={isSelected}
					aria-disabled={option.disabled}
					tabIndex={isActive ? 0 : -1}
				>
					<div className="option-content">
						<div>{highlightMatchedText(String(option.label || ''), searchText)}</div>
						{option.type === 'custom' && (
							<div className="option-badge">{capitalize(option.type)}</div>
						)}
					</div>
				</div>
			);
		},
		[highlightMatchedText, searchText, onChange, activeOptionIndex],
	);

	/**
	 * Helper function to render option with index tracking
	 */
	const renderOptionWithIndex = useCallback(
		(option: OptionData, isSelected: boolean, idx: number) =>
			renderOptionItem(option, isSelected, idx),
		[renderOptionItem],
	);

	/**
	 * Custom clear button renderer
	 */
	const clearIcon = useCallback(
		() => (
			<CloseOutlined
				onClick={(e): void => {
					e.stopPropagation();
					if (onChange) onChange(undefined, []);
					if (onClear) onClear();
				}}
			/>
		),
		[onChange, onClear],
	);

	// ===== Event Handlers =====

	/**
	 * Handles search input changes
	 */
	const handleSearch = useCallback(
		(value: string): void => {
			const trimmedValue = value.trim();
			setSearchText(trimmedValue);

			if (onSearch) onSearch(trimmedValue);
		},
		[onSearch],
	);

	/**
	 * Prevents event propagation for dropdown clicks
	 */
	const handleDropdownClick = useCallback((e: React.MouseEvent): void => {
		e.stopPropagation();
	}, []);

	/**
	 * Comprehensive keyboard navigation handler
	 */
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent): void => {
			// Handle keyboard navigation when dropdown is open
			if (isOpen) {
				// Get flattened list of all selectable options
				const getFlatOptions = (): OptionData[] => {
					if (!filteredOptions) return [];

					const flatList: OptionData[] = [];

					// Process options
					const { sectionOptions, nonSectionOptions } = splitOptions(
						isEmpty(value)
							? filteredOptions
							: prioritizeOrAddOptionForSingleSelect(filteredOptions, value),
					);

					// Add custom option if needed
					if (!isEmpty(searchText) && !isLabelPresent(filteredOptions, searchText)) {
						flatList.push({
							label: searchText,
							value: searchText,
							type: 'custom',
						});
					}

					// Add all options to flat list
					flatList.push(...nonSectionOptions);
					sectionOptions.forEach((section) => {
						if (section.options) {
							flatList.push(...section.options);
						}
					});

					return flatList;
				};

				const options = getFlatOptions();

				switch (e.key) {
					case 'ArrowDown':
						e.preventDefault();
						setActiveOptionIndex((prev) =>
							prev < options.length - 1 ? prev + 1 : 0,
						);
						break;

					case 'ArrowUp':
						e.preventDefault();
						setActiveOptionIndex((prev) =>
							prev > 0 ? prev - 1 : options.length - 1,
						);
						break;

					case 'Tab':
						// Tab navigation with Shift key support
						if (e.shiftKey) {
							e.preventDefault();
							setActiveOptionIndex((prev) =>
								prev > 0 ? prev - 1 : options.length - 1,
							);
						} else {
							e.preventDefault();
							setActiveOptionIndex((prev) =>
								prev < options.length - 1 ? prev + 1 : 0,
							);
						}
						break;

					case 'Enter':
						e.preventDefault();
						if (activeOptionIndex >= 0 && activeOptionIndex < options.length) {
							// Select the focused option
							const selectedOption = options[activeOptionIndex];
							if (onChange) {
								onChange(selectedOption.value, selectedOption);
								setIsOpen(false);
								setActiveOptionIndex(-1);
							}
						} else if (!isEmpty(searchText)) {
							// Add custom value when no option is focused
							const customOption = {
								label: searchText,
								value: searchText,
								type: 'custom',
							};
							if (onChange) {
								onChange(customOption.value, customOption);
								setIsOpen(false);
								setActiveOptionIndex(-1);
							}
						}
						break;

					case 'Escape':
						e.preventDefault();
						setIsOpen(false);
						setActiveOptionIndex(-1);
						break;

					case ' ': // Space key
						if (activeOptionIndex >= 0 && activeOptionIndex < options.length) {
							e.preventDefault();
							const selectedOption = options[activeOptionIndex];
							if (onChange) {
								onChange(selectedOption.value, selectedOption);
								setIsOpen(false);
								setActiveOptionIndex(-1);
							}
						}
						break;
					default:
						break;
				}
			} else if (e.key === 'ArrowDown' || e.key === 'Tab') {
				// Open dropdown when Down or Tab is pressed while closed
				e.preventDefault();
				setIsOpen(true);
				setActiveOptionIndex(0);
			}
		},
		[
			isOpen,
			activeOptionIndex,
			filteredOptions,
			searchText,
			onChange,
			splitOptions,
			value,
			isLabelPresent,
		],
	);

	// ===== Dropdown Rendering =====

	/**
	 * Renders the custom dropdown with sections and keyboard navigation
	 */
	const customDropdownRender = useCallback((): React.ReactElement => {
		// Process options based on current value
		let processedOptions = isEmpty(value)
			? filteredOptions
			: prioritizeOrAddOptionForSingleSelect(filteredOptions, value);

		if (!isEmpty(searchText)) {
			processedOptions = filterOptionsBySearch(processedOptions, searchText);
		}

		const { sectionOptions, nonSectionOptions } = splitOptions(processedOptions);

		// Check if we need to add a custom option based on search text
		const isSearchTextNotPresent =
			!isEmpty(searchText) && !isLabelPresent(processedOptions, searchText);

		let optionIndex = 0;

		// Add custom option if needed
		if (isSearchTextNotPresent) {
			nonSectionOptions.unshift({
				label: searchText,
				value: searchText,
				type: 'custom',
			});
		}

		// Helper function to map options with index tracking
		const mapOptions = (options: OptionData[]): React.ReactNode =>
			options.map((option) => {
				const result = renderOptionWithIndex(
					option,
					option.value === value,
					optionIndex,
				);
				optionIndex += 1;
				return result;
			});

		const customMenu = (
			<div
				ref={dropdownRef}
				className="custom-select-dropdown"
				onClick={handleDropdownClick}
				onKeyDown={handleKeyDown}
				role="listbox"
				tabIndex={-1}
				aria-activedescendant={
					activeOptionIndex >= 0 ? `option-${activeOptionIndex}` : undefined
				}
			>
				{/* Non-section options */}
				<div className="no-section-options">
					{nonSectionOptions.length > 0 && mapOptions(nonSectionOptions)}
				</div>

				{/* Section options */}
				{sectionOptions.length > 0 &&
					sectionOptions.map((section) =>
						!isEmpty(section.options) ? (
							<div className="select-group" key={section.label}>
								<div className="group-label" role="heading" aria-level={2}>
									{section.label}
								</div>
								<div role="group" aria-label={`${section.label} options`}>
									{section.options && mapOptions(section.options)}
								</div>
							</div>
						) : null,
					)}

				{/* Navigation help footer */}
				<div className="navigation-footer" role="note">
					{!loading && !errorMessage && !noDataMessage && (
						<section className="navigate">
							<ArrowDown size={8} className="icons" />
							<ArrowUp size={8} className="icons" />
							<span className="keyboard-text">to navigate</span>
						</section>
					)}
					{loading && (
						<div className="navigation-loading">
							<div className="navigation-icons">
								<LoadingOutlined />
							</div>
							<div className="navigation-text">We are updating the values...</div>
						</div>
					)}
					{errorMessage && !loading && (
						<div className="navigation-error">
							<div className="navigation-text">
								{errorMessage || SOMETHING_WENT_WRONG}
							</div>
							<div className="navigation-icons">
								<ReloadOutlined
									twoToneColor={Color.BG_CHERRY_400}
									onClick={(e): void => {
										e.stopPropagation();
										if (onRetry) onRetry();
									}}
								/>
							</div>
						</div>
					)}

					{noDataMessage && !loading && (
						<div className="navigation-text">{noDataMessage}</div>
					)}
				</div>
			</div>
		);

		return dropdownRender ? dropdownRender(customMenu) : customMenu;
	}, [
		value,
		filteredOptions,
		searchText,
		splitOptions,
		isLabelPresent,
		handleDropdownClick,
		handleKeyDown,
		activeOptionIndex,
		loading,
		errorMessage,
		noDataMessage,
		dropdownRender,
		renderOptionWithIndex,
		onRetry,
	]);

	// ===== Side Effects =====

	// Clear search text when dropdown closes
	useEffect(() => {
		if (!isOpen) {
			setSearchText('');
			setActiveOptionIndex(-1);
		}
	}, [isOpen]);

	// Auto-scroll to active option for keyboard navigation
	useEffect(() => {
		if (
			isOpen &&
			activeOptionIndex >= 0 &&
			optionRefs.current[activeOptionIndex]
		) {
			optionRefs.current[activeOptionIndex]?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			});
		}
	}, [isOpen, activeOptionIndex]);

	// ===== Final Processing =====

	// Apply highlight to matched text in options
	const optionsWithHighlight = useMemo(
		() =>
			options
				?.filter((option) =>
					String(option.label || '')
						.toLowerCase()
						.includes(searchText.toLowerCase()),
				)
				?.map((option) => ({
					...option,
					label: highlightMatchedText(String(option.label || ''), searchText),
				})),
		[options, searchText, highlightMatchedText],
	);

	// ===== Component Rendering =====
	return (
		<Select
			ref={selectRef}
			className={cx('custom-select', className)}
			placeholder={placeholder}
			showSearch
			filterOption={false}
			onSearch={handleSearch}
			value={value}
			onChange={onChange}
			onDropdownVisibleChange={setIsOpen}
			open={isOpen}
			options={optionsWithHighlight}
			defaultActiveFirstOption={defaultActiveFirstOption}
			popupMatchSelectWidth={popupMatchSelectWidth}
			allowClear={allowClear ? { clearIcon } : false}
			getPopupContainer={getPopupContainer ?? popupContainer}
			suffixIcon={<DownOutlined style={{ cursor: 'default' }} />}
			dropdownRender={customDropdownRender}
			menuItemSelectedIcon={null}
			popupClassName={cx('custom-select-dropdown-container', popupClassName)}
			listHeight={300}
			placement={placement}
			optionFilterProp="label"
			notFoundContent={<div className="empty-message">{noDataMessage}</div>}
			onKeyDown={handleKeyDown}
			{...rest}
		/>
	);
};

export default CustomSelect;
